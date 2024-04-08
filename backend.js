import * as game from 'gameCode'
import { start } from 'repl'
const deck = new game.Deck()

const fs = require('fs')

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

const users = {} // a dictionary of objects with each key being the socket.id

var rooms = [{name: "All-In Arena", currentUsers: [], canJoin: true}, {name: "PokerPalooza", currentUsers: [], canJoin: true}] // a list of objects (roomName, numOfPeopleInRoom)

app.get('/room/:roomName', (req, res) => {
    let roomNames = []
    rooms.forEach((room)=>{ roomNames.push(room.name) })
    roomName = req.params["roomName"]
    if (roomNames.includes(roomName)){
        rooms.forEach((room) => {
            if (room.name == roomName){
                if (rooms[rooms.indexOf(room)].canJoin)
                    res.sendFile(__dirname + '/public/html_files/room.html')
                else
                    res.sendFile(__dirname + '/public/html_files/error.html')
            }
        })
        
    }
})

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
                this.cards.push(value + " of " + suit)
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
    constructor(num, socketID) {
        this.playerNum = num
        this.socketID = socketID

        this.cash = 100 // dollars
        this.wins = 0
        this.cards = []

        this.bet = 0 // amount currently being betted
        this.action = "none" // none, check, raise, fold
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
        this.reset()
    }

    reset() {
        this.players = []
        
        this.pot = 0
        this.deck = new Deck() // is already shuffled
        this.tableCards = []
        this.allDone = false // (time to reveal cards) will be allDone when all 5 cards have been layed out and all bets have been made

        this.dealerNum = 0 // playerNum
        this.smallBindNum = 0
        this.bigBlindNum = 0
    }

    revealTableCard() {
        this.tableCards.push(this.deck.getCard())
    }

    dealOut2ToEachPlayer() {
        this.players.forEach((player) => {
            player.deal(this.deck.getCard(), this.deck.getCard())
        })
    }
}

function startNewGame(room){
    room.table = new Table()

    let playerNum = 1
    room.currentUsers.forEach((user) => {
        room.table.players.push(new Player(playerNum, user.keys()[0]))
        playerNum ++
    })

    room.table.dealerNum = 0 // they will be increased all by 1 when the game starts (so this will be playerNum 1)
    room.table.smallBindNum = 1
    room.table.bigBlindNum = 2

    startGame(room)
}

function startGame(room){
    room.table.dealerNum ++
    room.table.smallBindNum ++
    room.table.bigBlindNum ++

    room.table.players.forEach((player) => {
        if (player.playerNum == room.table.smallBindNum){
            player.loseCash(1)
            // socket send smallBind
        }
        if (player.playerNum == room.table.bigBlindNum){
            player.loseCash(2)
            // socket send bigBind
        }
    })

    room.table.dealOut2ToEachPlayer()
    // socket send deal 2 cards to each player

    // socket.send begin-bets
}


// reading JSON data
io.on('connection', (socket) => {

    console.log('a user connected')
    users[socket.id] = {name: 'Internet Surfer', room: null}
    io.emit('updateUsers', users) // will this give errors?

    socket.on('disconnect', (reason) => {
        console.log(reason)

        delete users[socket.id]
        io.emit('updateUsers', users)
    })

    socket.on('join room', (roomName) => {
        users[socket.id].room = roomName
        socket.join(roomName)
        
        rooms.forEach((room) => {
            if (room.name == roomName){
                if (rooms[rooms.indexOf(room)].canJoin)
                    io.emit('joinRoom', roomName);
                else
                    io.emit('room full')
            }
        })
        
        
    })

    socket.on('startGame', () => {
        roomName = users[socket.id].room
        rooms.forEach((room) => {
            if (room.name == roomName){
                rooms[rooms.indexOf(room)].canJoin = false;
                startNewGame(room)
            }
        })
    })

})


setInterval(() => {

    io.emit('updateRooms', rooms)

    for (const userID in users){
        if (users[userID].room != null)
            io.to(userID).emit('updateUsers', users)
    }
    
}, 15)
  
  
server.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})
  
console.log('server did load')