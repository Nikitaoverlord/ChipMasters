const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
var HandSolver = require('pokersolver').Hand;


const express = require("express")
const app = express()

// socket.io setup
const http = require("http")
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 })

const port = 3003

app.use(express.static('public'))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/html_files/index.html')
})

var socketIDToSessionID = {} // socketID: sessionID
var sessionIDToMostRecentSocketID = {}
const users = {} // a dictionary of objects with each key being the sessionID

var rooms = [{name: "All-In Arena", currentUsers: {}, canJoin: true, currentBetter: 0}, {name: "PokerPalooza", currentUsers: {}, canJoin: true, currentBetter: 0}] // a list of objects (roomName, numOfPeopleInRoom)

var setToDeleteSessions = [] // [[roomIndex, sessionID], [roomIndex, sessionID]]

app.get('/room/:roomName', (req, res) => {
    let roomNames = []
    rooms.forEach((room)=>{ roomNames.push(room.name) })
    roomName = req.params["roomName"]
    if (roomNames.includes(roomName)){
        if (rooms[getRoomIndexFromRoomName(roomName)].canJoin){
            res.sendFile(__dirname + '/public/html_files/room.html')
        }
            
        else
            res.sendFile(__dirname + '/public/html_files/error.html')

    }
})

app.get('/login', (req, res) => {
    res.sendFile(__dirname + '/public/html_files/login.html')
})

app.get('/roomPage', (req, res) => {
    res.sendFile(__dirname + '/public/html_files/roomPage.html')
})


class Card {
    constructor(value, suit){
        this.value = value
        this.suit = suit
        this.valueToPoints = {"2": 2, "3":3, "4": 4, "5":5, "6":6, "7":7, "8":8, "9":9, "10":10, "J":11, "Q":12, "K":13, "A":14}
        
        this.suitCompressed = suit[0].toLowerCase()
    }

    isGreater(otherCard){
        if (this.valueToPoints[this.value] > this.valueToPoints[otherCard.value]) return true
        return false
    }

    toString() {
        return this.value + " of " + this.suit
    }
}

class Deck {
    constructor(){
        this.values = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"]
        this.suits = ["Spades", "Clubs", "Hearts", "Diamonds"]
        this.cards = []
        this.reset()
        this.shuffle()
    }

    reset() {
        this.cards = []
        this.values.forEach((value) => {
            this.suits.forEach((suit) => {
                this.cards.push(new Card(value, suit))
            })
        })
    }

    shuffle() {
        this.cards.sort(() => Math.random() - 0.5)
    }

    getCard() {
        let card = this.cards[this.cards.length - 1]
        this.cards.pop()
        return card
    }

}

class Player {
    constructor(num, tagColor, name) {
        this.playerNum = num
        this.tagColor = tagColor
        this.name = name

        this.cash = 100 // dollars
        this.wins = 0
        this.cards = []

        this.bet = 0 // amount currently being betted
        this.action = "none" // none, check/call, raise, fold
        this.status = "playing" // playing, folded, out-of-money

        this.handValue = ""

    }

    deal(card1, card2) {
        this.cards.push(card1)
        this.cards.push(card2)
    }

    loseCash(amount) {
        if (this.cash - amount >= 0)
            this.cash -= amount
        else {
            this.cash = 0
            this.status = "out-of-money"
        }
    }

    gainCash(amount) {
        this.cash += amount
        this.wins ++
    }
}

class Table {
    constructor() {
        this.players = {}

        this.dealerNum = 0 // playerNum
        this.smallBindNum = 0
        this.bigBlindNum = 0

        this.deckClicked = null

        this.reset()
    }

    reset() {
        this.pot = 0
        this.deck = new Deck() // is already shuffled
        this.tableCards = []
        this.allDone = false // (time to reveal cards) will be allDone when all 5 cards have been layed out and all bets have been made
        this.currentCall = 0

        this.deckClicked = null
    }

    revealTableCard(times) {
        for (let i=0; i<times; i++)
            this.tableCards.push(this.deck.getCard())
    }

    dealOut2ToEachPlayer() {
        for (playerID in this.players){
            this.players[playerID].deal(this.deck.getCard(), this.deck.getCard())
        }
    }
}

function emitUpdateLobby(room){
    lobbyInfo = {"users": {}}
    for (userID in room.currentUsers){
        lobbyInfo["users"][userID] = {
            "tagColor": accountInfo[users[userID].email].tagColor,
            "name": accountInfo[users[userID].email].displayname,
        }
    }
    lobbyInfo["roomName"] = room.name
    io.to(room.name).emit('update lobby', (lobbyInfo))
}

function emitUpdatePlayer(room){
    for (playerID in room.table.players){
        let otherPlayerInfo = {}
        for (otherPlayerID in room.table.players){
            if (otherPlayerID==playerID) continue
            otherPlayerInfo[room.table.players[otherPlayerID].playerNum] = {
                "cash": room.table.players[otherPlayerID].cash,
                "bet": room.table.players[otherPlayerID].bet,
                "action": room.table.players[otherPlayerID].action,
                "playerNum": room.table.players[otherPlayerID].playerNum,
                "tagColor": accountInfo[users[otherPlayerID].email].tagColor,
                "name": accountInfo[users[otherPlayerID].email].displayname
            }
        }
        // updating each player with their info
        // add only selective info of the other players
        io.to(sessionIDToMostRecentSocketID[playerID]).emit('update player', ([room.table.players[playerID], otherPlayerInfo]))
    }
}

function startNewGame(room, socketID){
    room.table = new Table()

    let playerNum = 1
    for (userID in room.currentUsers){
        room.table.players[userID] = new Player(playerNum, accountInfo[users[userID].email].tagColor, accountInfo[users[userID].email].displayname)
        playerNum++
    }

    room.table.dealerNum = 0 // they will be increased all by 1 when the game starts (so this will be playerNum 1)
    room.table.smallBindNum = 1
    room.table.bigBlindNum = 2

    emitUpdatePlayer(room)

    startGame(room)
}

function getSessionIDFromPlayerNum(playerNum, room){
    for (ID in room.table.players)
        if (room.table.players[ID].playerNum == playerNum) return sessionIDToMostRecentSocketID[ID]
}
function getPlayerIDFromPlayerNum(playerNum, room){
    for (ID in room.table.players)
        if (room.table.players[ID].playerNum == playerNum) return ID
}

function askForNextBet(room, specificyBetter){
    let orderedPlayerNums = []
    if (specificyBetter != null){
        room.currentBetter = specificyBetter
    }
    else{
        for (playerID in room.table.players) {
            if (room.table.players[playerID].status != "folded")
                orderedPlayerNums.push(room.table.players[playerID].playerNum)
        }
        
        if (orderedPlayerNums.indexOf(room.currentBetter) + 1 >= orderedPlayerNums.length)
            room.currentBetter = orderedPlayerNums[0]
        else
            room.currentBetter = orderedPlayerNums[orderedPlayerNums.indexOf(room.currentBetter) + 1]
    }


    betterPlayerId = getSessionIDFromPlayerNum(room.currentBetter, room)
    io.to(betterPlayerId).emit('ask bets', room.table.currentCall)
    io.to(room.name).emit('current better', room.currentBetter)
}

function startGame(room){
    room.table.dealerNum ++
    room.table.smallBindNum ++
    room.table.bigBlindNum ++
    if (room.table.bigBlindNum > Object.keys(room.table.players).length) room.table.bigBlindNum = 1
    if (room.table.smallBindNum > Object.keys(room.table.players).length) room.table.smallBindNum = 1
    if (room.table.dealerNum > Object.keys(room.table.players).length) room.table.dealerNum = 1

    for (playerID in room.table.players){
        if (room.table.players[playerID].playerNum == room.table.smallBindNum){
            room.table.players[playerID].loseCash(1)
            room.table.players[playerID].action = "Small Bind: $1"
        }
        
        if (room.table.players[playerID].playerNum == room.table.bigBlindNum){
            room.table.players[playerID].loseCash(2)
            room.table.players[playerID].action = "Big Bind: $2"
        }
        
    }
    room.table.currentCall = 2
    emitUpdatePlayer(room)

    io.to(room.name).emit('small bind', (room.table.smallBindNum))
    io.to(room.name).emit('big bind', (room.table.bigBlindNum))
    io.to(room.name).emit('dealer', (room.table.dealerNum))
}

function beginRound(room){
    room.table.dealOut2ToEachPlayer()
    emitUpdatePlayer(room)
    // socket send deal 2 cards to each player
    for (playerID in room.table.players){
        io.to(sessionIDToMostRecentSocketID[playerID]).emit('deal 2 cards')
    }

    // socket.send ask-bets for
    room.currentBetter = room.table.smallBindNum
    io.to(room.name).emit('current better', room.currentBetter)
    
    io.to(getSessionIDFromPlayerNum(room.currentBetter, room)).emit('ask bets', room.table.currentCall)

    room.table.deckClicked = false
}

function resetRound(room){
    // refresh player stats
    for (playerID in room.table.players){
        room.table.players[playerID].cards = []
        room.table.players[playerID].bet = 0
        room.table.players[playerID].action = "none"
        room.table.players[playerID].status = "playing"
    }

    room.table.reset() // resets deck, pot, tableCards, allDone status
    room.allPlayersBet = false
    io.to(room.name).emit('reset')

    startGame(room)
}

function resetRoom(room){
    rooms[getRoomIndexFromRoomName(room.name)] = {name: room.name, currentUsers: {}, canJoin: true, currentBetter: 0}
}


function getWinnerID(room){ // need to find a method to determine winner in poker
    let hands = {}

    // let fakeHands = [['7s', '8s', '9s', 'Ts', 'Js', 'Qs', "Ks"], ['7c', '8s', '9s', 'Ts', 'Js', 'Qs', "Ks"], ['7h', '8s', '9s', 'Ts', 'Js', 'Qs', "Ks"]]
    // let index = 0;

    for (playerID in room.table.players){
        let player = room.table.players[playerID]

        if (player.status != "folded"){
            let cards = [...player.cards, ...room.table.tableCards] //player.handValue

            let cardsToSolve = []
            cards.forEach((card) => {
                if (card.value == "10") cardsToSolve.push("T" + card.suitCompressed)
                else cardsToSolve.push(card.value + card.suitCompressed)
            })

    
            hands[playerID] = HandSolver.solve(cardsToSolve)
        }
    }

    let winnerHands = HandSolver.winners(Object.values(hands)) 


    winners = []
    for (playerID in hands){
        
        for (let i=0; i<winnerHands.length; i++){
            if (hands[playerID] + "" == winnerHands[i] + ""){
                winners.push(playerID)
                break;
            }
        }

    }
    return winners
}


function getRoomIndexFromRoomName(roomName){
    for (let i=0; i<rooms.length; i++){
        if (rooms[i].name == roomName)
            return i
    }
}

function haveAllPlayersBet(room){
    for (playerID in room.table.players){
        if (room.table.players[playerID].action == "none" || room.table.players[playerID].action == "Small Bind: $1" || room.table.players[playerID].action == "Big Bind: $2"){
            return false;
        }
    }
    return true;
}

var accountInfo = JSON.parse(fs.readFileSync(__dirname + '/public/data/accounts.json'))

// reading JSON data
io.on('connection', (socket) => {
    console.log('a user connected')

    io.to(socket.id).emit('give account info')

    socket.on('start-session', (sessionID) => {
        if (sessionID == null){
            var newSessionID = uuidv4().toString()
            socketIDToSessionID[socket.id] = newSessionID

            users[newSessionID] = {loggedIn: false, email: null, room: null}
    
            io.to(socket.id).emit('set-session-acknowledgement', newSessionID)

            sessionIDToMostRecentSocketID[newSessionID] = socket.id
        }
        else {
            socketIDToSessionID[socket.id] = sessionID
            sessionIDToMostRecentSocketID[sessionID] = socket.id
        }
    })

    socket.on('initial account info', (contents) => {
        let email = contents[0], password = contents[1]
        sessionID = socketIDToSessionID[socket.id]
        if (email in accountInfo && accountInfo[email]["password"] == password){
            users[sessionID].loggedIn = true;
            users[sessionID].email = email

            io.to(socket.id).emit('logged in')
        }
    })

    socket.on('log in', (contents) => {
        let email = contents[0], password = contents[1]
        sessionID = socketIDToSessionID[socket.id]
        if (email in accountInfo && accountInfo[email]["password"] == password){
            io.to(socket.id).emit('logged in', [email, password])
            users[sessionID].loggedIn = true;
            users[sessionID].email = email
        }
        else { io.to(socket.id).emit('log in failed') }
    })

    socket.on('sign up', (contents) => {
        io.to(socket.id).emit('account created')
        let email = contents[0], password = contents[1], displayname = contents[2]
        sessionID = socketIDToSessionID[socket.id]
        if (email in accountInfo){ io.to(socket.id).emit('account already exists') }
        else{
            accountInfo[email] = {password: password, displayname: displayname, tagColor: null}
            users[sessionID].loggedIn = true;
            users[sessionID].email = email;
            io.to(socket.id).emit('account created', [email, password])
        }
    })

    socket.on('change profile asthetics', (tagChoice) => {
        sessionID = socketIDToSessionID[socket.id]
        if (users[sessionID].loggedIn){
            accountInfo[users[sessionID].email].tagColor = tagChoice
        }
    })


    socket.on('disconnect', (reason) => {
        console.log(reason)

        // delete users[socket.id]
        rooms.forEach((room) => {
            sessionID = socketIDToSessionID[socket.id]
            if (Object.keys(room.currentUsers).includes(sessionID)){
                setToDeleteSessions.push([getRoomIndexFromRoomName(room.name), sessionID])
            }
        })
        io.emit('updateUsers', users)
    })

    socket.on('join room', (roomName) => {
        if (rooms[getRoomIndexFromRoomName(roomName)].canJoin){

            if (users[socketIDToSessionID[socket.id]].loggedIn){
                users[socketIDToSessionID[socket.id]].room = roomName
                io.to(socket.id).emit('joinRoom', roomName);
                //emitUpdatePlayer(rooms[getRoomIndexFromRoomName(roomName)])
            }
            else io.to(socket.id).emit('must log in')
        }
            
        else
            io.to(socket.id).emit('room full')
    })

    socket.on('room joined', () => {
        roomName = users[socketIDToSessionID[socket.id]].room
        console.log('   joining occured to room ' + roomName)
        socket.join(roomName)

        rooms[getRoomIndexFromRoomName(roomName)].currentUsers[socketIDToSessionID[socket.id]] = users[socketIDToSessionID[socket.id]]

        roomPlayers = []
        for (userID in rooms[getRoomIndexFromRoomName(roomName)].currentUsers){
            roomPlayers.push(accountInfo[users[userID].email].displayname)
        }

        emitUpdateLobby(rooms[getRoomIndexFromRoomName(roomName)])
    })

    socket.on('addRoom', (newRoomName) => {
        sessionID = socketIDToSessionID[socket.id]
        
        if (!users[socketIDToSessionID[socket.id]].loggedIn){
            io.to(socket.id).emit('must log in')
        }
        else {
            if (newRoomName == ""){
                newRoomName = accountInfo[users[sessionID].email].displayname + "'s" + 'Room'
              }
              
              rooms.forEach((room) => {
                  while (room["name"] == newRoomName){
                      newRoomName = "Different " + newRoomName
                  }
              })
              
              rooms.push({name: newRoomName, currentUsers: {}, canJoin: true, currentBetter: 0})
      
              io.emit('updateRooms', rooms)
          
              console.log(newRoomName + " room added!")
        }
      })

    socket.on('startGame', () => {
        roomName = users[socketIDToSessionID[socket.id]].room
        room = rooms[getRoomIndexFromRoomName(roomName)]
        if (Object.keys(room.currentUsers).length >= 2){
            if (rooms[getRoomIndexFromRoomName(roomName)].canJoin){
                rooms[getRoomIndexFromRoomName(roomName)].canJoin = false;
                io.to(roomName).emit('remove start button')
                startNewGame(room, socket.id)
            }
        }
        else
            io.to(socket.id).emit('not enough players')
    })

    socket.on('deck clicked', () => {
        sessionID = socketIDToSessionID[socket.id]
        if (users[sessionID] == null) return;
        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]

        if (!room.canJoin && room.table.dealerNum == room.table.players[sessionID].playerNum){
            if (room.table.deckClicked == null) beginRound(room)
            else {
                room.table.deckClicked = true
                
                if (room.table.tableCards.length < 5 && room.allPlayersBet){
                    if (room.table.tableCards.length == 0)
                        room.table.revealTableCard(3)
                    else
                        room.table.revealTableCard(1)
                
                    io.to(room.name).emit('reveal table cards', room.table.tableCards)
                    
                    if (room.table.players[getPlayerIDFromPlayerNum(room.table.smallBindNum, room)].status == "folded"){
                        room.currentBetter = room.smallBindNum
                        askForNextBet(room, null)
                    }
                    else askForNextBet(room, room.table.smallBindNum)

                    room.allPlayersBet = false
                }
                room.table.deckClicked = false
            }
        }
    })

    socket.on('call', () => {
        sessionID = socketIDToSessionID[socket.id]
        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]

        if (room.table.players[sessionID].status != "folded" && (room.table.players[sessionID].action == "none" || room.table.players[sessionID].action == "Small Bind: $1" || room.table.players[sessionID].action == "Big Bind: $2")){
            if (room.table.players[sessionID].cash - room.table.currentCall >= 0)
                room.table.players[sessionID].bet = room.table.currentCall
            else room.table.players[sessionID].bet = room.table.players[sessionID].cash // this isn't part of game rules just to avoid player trying to cheat

            room.table.players[sessionID].action = "call"

            if (!haveAllPlayersBet(room)){
                askForNextBet(room, null)
            }
        }

        emitUpdatePlayer(room)

       
    })

    socket.on('raise', (bet) => {
        bet = parseInt(bet)
        sessionID = socketIDToSessionID[socket.id]

        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]

        if (room.table.players[sessionID].status != "folded" && (room.table.players[sessionID].action == "none" || room.table.players[sessionID].action == "Small Bind: $1" || room.table.players[playerID].action == "Big Bind: $2")){
            if (room.table.players[sessionID].cash - bet - room.table.currentCall >= 0)
                room.table.players[sessionID].bet = bet + room.table.currentCall
            else room.table.players[sessionID].bet = room.table.players[sessionID].cash // }this isn't part of game rules just to prevent errors

            room.table.currentCall = room.table.players[sessionID].bet

            // asking for people to make new bets
            for (playerID in room.table.players)
                if (playerID != sessionID){
                    if (room.table.players[playerID].status != 'folded' && room.table.players[playerID].action != 'fold')
                        room.table.players[playerID].action = "none"
                    //io.to(sessionIDToMostRecentSocketID[playerID]).emit('ask bets', (room.table.currentCall))
                }
            room.table.players[sessionID].action = "raise"

            if (!haveAllPlayersBet(room)) askForNextBet(room, null)
        }
        emitUpdatePlayer(room)

        
    })

    socket.on('check', () => {
        sessionID = socketIDToSessionID[socket.id]

        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]

        if (room.table.players[sessionID].status != "folded" && (room.table.players[sessionID].action == "none" || room.table.players[sessionID].action == "Small Bind: $1" || room.table.players[sessionID].action == "Big Bind: $2")){
            if (room.table.currentCall == 0){
                room.table.players[sessionID].action = "check" // no need for else statement, just remove the check button from the screen, backend will handle hackers
                emitUpdatePlayer(room)
                if (!haveAllPlayersBet(room)) askForNextBet(room, null)
            }
            
        }
    })

    socket.on('fold', () => {
        sessionID = socketIDToSessionID[socket.id]

        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]

        if (room.table.players[sessionID].status != "folded" && (room.table.players[sessionID].action == "none" || room.table.players[sessionID].action == "Small Bind: $1" || room.table.players[sessionID].action == "Big Bind: $2")){
            room.table.players[sessionID].action = "fold"

            emitUpdatePlayer(room)

            if (!haveAllPlayersBet(room)) askForNextBet(room, null)
        }
    })

})

setInterval(() => {

    fs.writeFileSync(__dirname + '/public/data/accounts.json', JSON.stringify(accountInfo))

    io.emit('updateRooms', rooms)

    io.emit('updateUsers', users)

    rooms.forEach((room) => {
        if (room.canJoin){
            emitUpdateLobby(room)
            return // to ensure room game has started
        } 

        // Determine if all the players have made their move
        allPlayersActed = haveAllPlayersBet(room)

        // Do the actions of the players (if all have made a move)
        if (allPlayersActed){
            for (playerID in room.table.players){
                if (room.table.players[playerID].action == "call" || room.table.players[playerID].action == "raise"){
                    room.table.players[playerID].loseCash(room.table.players[playerID].bet)
                    room.table.players[playerID].action = 'none'
                }
                if (room.table.players[playerID].action == "check")
                    room.table.players[playerID].action = "none"
            
                if (room.table.players[playerID].action == "fold"){
                    room.table.players[playerID].status = "folded"
                    // room.table.players[playerID].action = "none" (don't change this: helps the allPlayersActed loop work)
                }
                room.allPlayersBet = true
            }

            // add money to pot
            for (playerID in room.table.players){
                room.table.pot += room.table.players[playerID].bet
                room.table.players[playerID].bet = 0
            }
            room.table.currentCall = 0

            io.to(room.name).emit('pot size', room.table.pot)
            emitUpdatePlayer(room)

            // reveal next card or declare winner
            if (room.table.tableCards.length < 5){
            }
            else { // all 5 cards on table and all bets are made: there is a winner!
                room.table.allDone = true

                winningPlayerIDs = getWinnerID(room)// check for winner and add winnings of pot

                let winners = []
                if (winningPlayerIDs.length > 1){
                    winningPlayerIDs.forEach((winningPlayerID) => {
                        room.table.players[winningPlayerID].gainCash(room.table.pot / winningPlayerIDs.length)
                        winners.push(room.table.players[winningPlayerID].playerNum)
                    })
                }
                else {
                    room.table.players[winningPlayerIDs[0]].gainCash(room.table.pot)
                    winners.push(room.table.players[winningPlayerIDs[0]].playerNum)
                }
                
            
                emitUpdatePlayer(room)
                io.to(room.name).emit('winner', winners)
                
                resetRound(room)
            }
        }
    })
    setToDeleteSessions.forEach((deleteInfo) => {
        let roomIndex = deleteInfo[0], sessionID = deleteInfo[1]
        delete rooms[roomIndex].currentUsers[sessionID]
        if (rooms[roomIndex].table != null && Object.keys(rooms[roomIndex].table.players).includes(sessionID)){
            io.to(rooms[roomIndex].name).emit('user left', (rooms[roomIndex].table.players[sessionID].playerNum))
            delete rooms[roomIndex].table.players[sessionID]

            for (socketID in socketIDToSessionID)
                if (socketIDToSessionID[socketID] == sessionID) delete socketIDToSessionID[socketID]
            
            
            if (Object.keys(room.currentUsers).length == 0)
                resetRoom(rooms[roomIndex])
        }
    })
    setToDeleteSessions = []

    // TODO:  Create an algorithm in getWinnerID to determine winner
}, 15)


server.listen(port, () => { 
   console.log(`Example app listening on port ${port}`)
})

console.log('server did load')