//const fs = require('fs')
const { v4: uuidv4 } = require('uuid')

const express = require("express")
const app = express()

// socket.io setup
const http = require("http")
const server = http.createServer(app)
const { Server } = require('socket.io')
const io = new Server(server, { pingInterval: 2000, pingTimeout: 5000 })

const port = 3000

app.use(express.static('public'))

app.get('/', (req, res) => {
    res.sendFile(__dirname + '/public/html_files/index.html')
})

var socketIDToSessionID = {} // socketID: sessionID
var sessionIDToMostRecentSocketID = {}
const users = {} // a dictionary of objects with each key being the sessionID

var rooms = [{name: "All-In Arena", currentUsers: {}, canJoin: true}, {name: "PokerPalooza", currentUsers: {}, canJoin: true}] // a list of objects (roomName, numOfPeopleInRoom)

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


class Card {
    constructor(value, suit){
        this.value = value
        this.suit = suit
        this.valueToPoints = {"2": 2, "3":3, "4": 4, "5":5, "6":6, "7":7, "8":8, "9":9, "10":10, "J":11, "Q":12, "K":13, "A":14}
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
    constructor(num) {
        this.playerNum = num

        this.cash = 100 // dollars
        this.wins = 0
        this.cards = []

        this.bet = 0 // amount currently being betted
        this.action = "none" // none, check/call, raise, fold
        this.status = "playing" // playing, folded, out-of-money
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

        this.reset()
    }

    reset() {
        this.pot = 0
        this.deck = new Deck() // is already shuffled
        this.tableCards = []
        this.allDone = false // (time to reveal cards) will be allDone when all 5 cards have been layed out and all bets have been made
        this.currentCall = 0
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

function emitUpdatePlayer(room){
    for (playerID in room.table.players){
        let otherPlayerInfo = {}
        for (otherPlayerID in room.table.players){
            if (otherPlayerID==playerID) continue
            otherPlayerInfo[room.table.players[otherPlayerID].playerNum] = {
                "cash": room.table.players[otherPlayerID].cash,
                "bet": room.table.players[otherPlayerID].bet,
                "action": room.table.players[otherPlayerID].action
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
        room.table.players[userID] = new Player(playerNum)
        playerNum++
    }

    room.table.dealerNum = 0 // they will be increased all by 1 when the game starts (so this will be playerNum 1)
    room.table.smallBindNum = 1
    room.table.bigBlindNum = 2

    emitUpdatePlayer(room)

    startGame(room, socketID)
}

function getPlayerIDFromPlayerNum(playerNum, room){
    for (ID in room.table.players)
        if (room.table.players[ID].playerNum == playerNum) return ID
}

function startGame(room, socketID){
    room.table.dealerNum ++
    room.table.smallBindNum ++
    room.table.bigBlindNum ++
    if (room.table.bigBlindNum >= Object.keys(room.table.players).length) room.table.bigBlindNum = 1
    if (room.table.smallBindNum >= Object.keys(room.table.players).length) room.table.smallBindNum = 1
    if (room.table.dealerNum >= Object.keys(room.table.players).length) room.table.dealerNum = 1

    for (playerID in room.table.players){
        if (room.table.players[playerID].playerNum == room.table.smallBindNum)
        room.table.players[playerID].loseCash(1)
        if (room.table.players[playerID].playerNum == room.table.bigBlindNum)
        room.table.players[playerID].loseCash(2)
    }
    room.table.currentCall = 2
    emitUpdatePlayer(room)

    io.to(room.name).emit('small bind', (room.table.smallBindNum))
    io.to(room.name).emit('big bind', (room.table.bigBlindNum))
    io.to(room.name).emit('dealer', (room.table.dealerNum))

    room.table.dealOut2ToEachPlayer()
    emitUpdatePlayer(room)
    // socket send deal 2 cards to each player
    for (playerID in room.table.players){
        io.to(sessionIDToMostRecentSocketID[playerID]).emit('deal 2 cards')
    }

    // socket.send ask-bets for
    io.to(room.name).emit('ask bets', room.table.currentCall)
}

function resetRound(room){
    // refresh player stats
    for (playerID in room.table.players){
        room.table.players[playerID].cards = []
        room.table.players[playerID].bet = 0
        room.table.players[playerID].action = "none"
        room.table.players[playerID].cards = "playing"
    }

    room.table.reset() // resets deck, pot, tableCards, allDone status
    io.to(room.name).emit('reset')
}

function getWinnerID(room){ // need to find a method to determine winner in poker
//  for (playerID in room.table.payers){
//     //
//  }
    return Object.keys(room.table.players)[0]
}

function getRoomIndexFromRoomName(roomName){
    for (let i=0; i<rooms.length; i++){
        if (rooms[i].name == roomName)
            return i
    }
}

// reading JSON data
io.on('connection', (socket) => {
    console.log('a user connected')

    socket.on('start-session', (sessionID) => {
        if (sessionID == null){
            var newSessionID = uuidv4().toString()
            socketIDToSessionID[socket.id] = newSessionID

            users[newSessionID] = {name: 'Internet Surfer', room: null}

            io.to(socket.id).emit('set-session-acknowledgement', newSessionID)

            sessionIDToMostRecentSocketID[newSessionID] = socket.id
        }
        else {
            socketIDToSessionID[socket.id] = sessionID
            sessionIDToMostRecentSocketID[sessionID] = socket.id
        }
    })


    socket.on('disconnect', (reason) => {
        console.log(reason)

        // delete users[socket.id]
        rooms.forEach((room) => {
            sessionID = socketIDToSessionID[socket.id]
            if (Object.keys(room.currentUsers).includes(sessionID)){
                delete rooms[getRoomIndexFromRoomName(room.name)].currentUsers[sessionID]
                if (room.table != null && Object.keys(room.table.players).includes(sessionID))
                    delete rooms[getRoomIndexFromRoomName(room.name)].table.players[sessionID]
            }
        })
        io.emit('updateUsers', users)
    })

    socket.on('join room', (roomName) => {
        if (rooms[getRoomIndexFromRoomName(roomName)].canJoin){
            users[socketIDToSessionID[socket.id]].room = roomName
            io.to(socket.id).emit('joinRoom', roomName);
        }
            
        else
            io.to(socket.id).emit('room full')
    })

    socket.on('room joined', () => {
        roomName = users[socketIDToSessionID[socket.id]].room
        console.log('   joining occured to room ' + roomName)
        socket.join(roomName)

        rooms[getRoomIndexFromRoomName(roomName)].currentUsers[socketIDToSessionID[socket.id]] = users[socketIDToSessionID[socket.id]]
    })

    socket.on('startGame', () => {
        roomName = users[socketIDToSessionID[socket.id]].room
        room = rooms[getRoomIndexFromRoomName(roomName)]
        if (Object.keys(room.currentUsers).length >= 2){
            rooms[getRoomIndexFromRoomName(roomName)].canJoin = false;
            io.to(roomName).emit('remove start button')
            startNewGame(room, socket.id)
        }
        else
            io.to(socket.id).emit('not enough players')
    })

    socket.on('call', () => {
        sessionID = socketIDToSessionID[socket.id]
        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]

        if (room.table.players[sessionID].status != "folded"){
            if (room.table.players[sessionID].cash - room.table.currentCall >= 0)
                room.table.players[sessionID].bet = room.table.currentCall
            else room.table.players[sessionID].bet = room.table.players[sessionID].cash // this isn't part of game rules just to avoid player trying to cheat

            room.table.players[sessionID].action = "call"
        }

        emitUpdatePlayer(room)
    })

    socket.on('raise', (bet) => {
        bet = parseInt(bet)
        sessionID = socketIDToSessionID[socket.id]

        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]

        if (room.table.players[sessionID].status != "folded"){
            if (room.table.players[sessionID].cash - bet - room.table.currentCall >= 0)
                room.table.players[sessionID].bet = bet + room.table.currentCall
            else room.table.players[sessionID].bet = room.table.players[sessionID].cash // }this isn't part of game rules just to prevent errors

            console.log('bet was ' + bet + ', but raise was ' + room.table.players[sessionID].bet)
            room.table.currentCall = room.table.players[sessionID].bet

            // asking for people to make new bets
            for (playerID in room.table.players)
                if (playerID != sessionID){
                    if (room.table.players[playerID].status != 'folded')
                        room.table.players[playerID].action = "none"

                    io.to(sessionIDToMostRecentSocketID[playerID]).emit('ask bets', (room.table.currentCall))
                }
        
            room.table.players[sessionID].action = "raise"
        }
        emitUpdatePlayer(room)
    })

    socket.on('check', () => {
        sessionID = socketIDToSessionID[socket.id]

        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]

        if (room.table.players[sessionID].status != "folded")
            if (room.table.currentCall == 0)
                room.table.players[sessionID].action = "check" // no need for else statement, just remove the check button from the screen, backend will handle hackers
                emitUpdatePlayer(room)
    })

    socket.on('fold', () => {
        sessionID = socketIDToSessionID[socket.id]

        let roomName = users[sessionID].room
        let room = rooms[getRoomIndexFromRoomName(roomName)]
        room.table.players[sessionID].action = "fold"

        emitUpdatePlayer(room)
    })

})


setInterval(() => {

    io.emit('updateRooms', rooms)

    io.emit('updateUsers', users)
    
    rooms.forEach((room) => {
        if (room.canJoin){
            return // to ensure room game has started
        } 

        let allPlayersActed = true

        // Determine if all the players have made their move
        for (playerID in room.table.players){
            if (room.table.players[playerID].action == "none"){
                allPlayersActed = false
                break
            }
        }
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
                if (room.table.tableCards.length == 0)
                    room.table.revealTableCard(3)
                else
                    room.table.revealTableCard(1)
            
                io.to(room.name).emit('reveal table cards', room.table.tableCards)
                
                io.to(room.name).emit('ask bets', 0)
            }
            else { // all 5 cards on table and all bets are made: there is a winner!
                room.table.allDone = true

                winningPlayerID = getWinnerID(room)// check for winner and add winnings of pot
                room.table.players[winningPlayerID].gainCash(room.table.pot)
            
                emitUpdatePlayer(room)
                io.to(room.name).emit('winner', room.table.players[winningPlayerID].playerNum)

                resetRound(room)
            }
        }
    })
    // TODO:  Create an algorithm in getWinnerID to determine winner
}, 15)


server.listen(port, () => { 
   console.log(`Example app listening on port ${port}`)
})

console.log('server did load')