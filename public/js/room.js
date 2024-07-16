const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const devicePixelRatio = window.devicePixelRatio || 1

canvas.width = 1600 * devicePixelRatio
canvas.height = 900 * devicePixelRatio

c.scale(devicePixelRatio, devicePixelRatio)

const socket = io()

// const observer = new ResizeObserver(myResizeTheCanvasFn);
// observer.observe(someCanvasElement);

window.onpageshow = function(event) {
  if (event.persisted) {
      window.location.reload() 
  }
};

var mySessionID = localStorage.getItem('sessionID')
socket.emit('start-session', mySessionID)

socket.on('set-session-acknowledgement', (sessionID) => {
  localStorage.setItem('sessionID', sessionID)
})

socket.on('give account info', () => {
  socket.emit('initial account info', [localStorage.getItem('email'), localStorage.getItem('password')])
})

socket.on('logged in', ()=>{
  console.log('logged in!')
})

var frontEndUsers = {};

var myPlayer = {}
var otherPlayers = {} // otherPlayers[playerNum] = {"cash":0, "action":0}
var knownCards = []

var smallBindNumber;
var bigBindNumber;
var dealerNumber;

var playersLeft = []

var potSize = 0

function getPlayerIDFromPlayerNum(playerNum){
  for (ID in otherPlayers)
      if (otherPlayers[ID].playerNum == playerNum) return ID
}

var cashToNumber = {0:'0', 20:'1', 50:'2', 100:'3', 200:'4', 500:'5'}

socket.emit('room joined')

// Initial info gotten
socket.on('updateUsers', (backendUsers) => {
  for (const backendID in backendUsers) {
    if (!frontEndUsers[backendID]){ // add new players
      frontEndUsers[backendID] = backendUsers[backendID]
    }
  }
  for (const frontendID in frontEndUsers) { // remove non-existing players
    if (!backendUsers[frontendID]){
      delete frontEndUsers[frontendID]
      break
    }
  }
})

socket.on('remove start button', () => {
  document.querySelector('#startButton').style.display = 'none'
})

socket.on('not enough players', () => {
  console.log('not enough players')
})
//////////////////////

socket.on('update player', (playerInfo) => {
  myPlayer = playerInfo[0], otherPlayers = playerInfo[1]
})


socket.on('small bind', (number) => {
   if (number == myPlayer.playerNum){
       smallBindNumber = number
       currentBetterNum = number
       // have some chip animation occur
   }
   else
       smallBindNumber = number
})
socket.on('big bind', (number) => {
  if (number == myPlayer.playerNum){
    bigBindNumber = number
    // have some chip animation occur
  }
  else
    bigBindNumber = number
})
socket.on('dealer', (number) => {
  if (number == myPlayer.playerNum){
    dealerNumber = number
    // have some chip animation occur
  }
  else
    dealerNumber = number
})




socket.on('deal 2 cards', () => {
  // animation of cards
  dealOutCards()

  myCard1.new_src('/imgs/cards' + `/${myPlayer.cards[0].suit}/` + myPlayer.cards[0].value + " of " + myPlayer.cards[0].suit + '.png')
  myCard2.new_src('/imgs/cards' + `/${myPlayer.cards[1].suit}/` + myPlayer.cards[1].value + " of " + myPlayer.cards[1].suit + '.png')

  myCard1.frontside = '/imgs/cards' + `/${myPlayer.cards[0].suit}/` + myPlayer.cards[0].value + " of " + myPlayer.cards[0].suit + '.png'
  myCard2.frontside = '/imgs/cards' + `/${myPlayer.cards[1].suit}/` + myPlayer.cards[1].value + " of " + myPlayer.cards[1].suit + '.png'
})




socket.on('ask bets', (currentCall) => { // IMPORTANT BUG FIX NECESSARY: DON'T DISPLAY FOLD OPTION IF EVERYONE ELSE IS FOLDED TOO
  haveMadeMove = false

  if (currentCall > 0 && myPlayer.status != 'folded'){
    canCheck = false
  }
  else if (myPlayer.status != 'folded'){
    canCheck = true
  }

  if (knockButton.src == ''){
    if (myPlayer.playerNum == 1 || myPlayer.playerNum == 2 || myPlayer.playerNum == 4 || myPlayer.playerNum == 5){
      knockButton.width = table.width / 6 * 1.25
      knockButton.height = table.height / 7 * 1.25
      knockButton.x = table.chairSpots[myPlayer.playerNum-1][0]

      if (myPlayer.playerNum == 1 || myPlayer.playerNum == 2) {
        knockButton.y = table.y + table.height - knockButton.height - table.height/16
        knockButton.frontside = '/imgs/knock-fold-buttons/knock-to-check-normal.png'
        knockButton.backside = '/imgs/knock-fold-buttons/drop-to-fold-normal.png'
      }
      else {
        knockButton.y = table.y + table.height/16
        knockButton.frontside = '/imgs/knock-fold-buttons/knock-to-check-upside.png'
        knockButton.backside = '/imgs/knock-fold-buttons/drop-to-fold-upside.png'
      }
    }
    else {
      knockButton.width = table.height / 7 * 1.25
      knockButton.height = table.width / 6 * 1.25
      knockButton.y = table.chairSpots[myPlayer.playerNum-1][1] - knockButton.height/2 + chairSize/2

      if (myPlayer.playerNum == 3) {
        knockButton.x = table.x + table.height/16
        knockButton.frontside = '/imgs/knock-fold-buttons/knock-to-check-left.png'
        knockButton.backside = '/imgs/knock-fold-buttons/drop-to-fold-left.png'
      }
      else {
        knockButton.x = table.x - table.height/16 - knockButton.width
        knockButton.frontside = '/imgs/knock-fold-buttons/knock-to-check-right.png'
        knockButton.backside = '/imgs/knock-fold-buttons/drop-to-fold-right.png'
      }
    }
  }
})


socket.on('pot size', (amount) => {
  pot.new_src('/imgs/call-buttons/call-button-' + cashToNumberConvertor(parseInt(amount)) + '.png')
  potSize = amount
})


socket.on('reveal table cards', (allTableCards) => {

  allTableCards.forEach((card) => {
      cardString = card.value + ' of ' + card.suit
      if (!knownCards.includes(cardString)){
          knownCards.push(cardString)

          tableCardSprites[knownCards.length-1].new_src('/imgs/cards' + `/${card.suit}/` + cardString + '.png')
          tableCardSprites[knownCards.length-1].frontside = '/imgs/cards' + `/${card.suit}/` + cardString + '.png'
      }
  })
})

socket.on('current better', (bettingPlayerNum) => {
  currentBetterNum = bettingPlayerNum
})


socket.on('winner', (winnerNums) => {
  // winner animation for self and for others

  if (winnerNums.length > 1){
    if (winnerNums[0] == myPlayer.playerNum) winnerMessage = "You won"
    else winnerMessage = "Player #" + winnerNums[0] + " won"
    
    for (let i=1; i<winnerNums.length; i++){
      if (winnerNums[i] == myPlayer.playerNum) winnerMessage += ' and You won'
      else winnerMessage += ' and Player #' + winnerNums[i] + " won"
    }
    
  }
  else {
    if (winnerNums[0] == myPlayer.playerNum){
      winnerMessage = "You Won!"
    }
    else {
      winnerMessage = "Player #" + winnerNums[0] + " won..."
    }
  }
})


socket.on('reset', () => { // Make a ready button!
  beginWinWait = true
})

socket.on('user left', (playerNum) => {
  playersLeft.push(playerNum)
})



document.querySelector('#startButton').addEventListener('click', function(){
  socket.emit('startGame')
})


class ImageSprite {
  constructor(x, y, width, height, src, rotate=0){
    this.x = x;
    this.y = y;
    this.width = width
    this.height = height
    this.src = src
    this.image = new Image()
    this.image.src = src
    this.rotate = rotate
    this.drawn = false
    this.needToDraw = true
  }

  new_src(src){
    this.src = src
    this.image.src = src
  }

  rotate(){
    c.save()
    c.translate()
    c.restore()
  }

  isTouching(px, py){
    if (px < this.x + this.width && px > this.x){
      if (py < this.y + this.height && py > this.y){
        return true
      }
    }
    return false
  }

  setSize(w, h){
    this.width = w, this.height = h
  }

  draw(){
    this.drawn = true
    if (this.rotate != 0){
      c.save()
      c.translate(this.x+this.width/2, this.y+this.height/2)
      c.rotate(this.rotate * Math.PI/180)
      c.drawImage(this.image, -this.width/2, -this.height/2, this.width, this.height)
      c.restore()
    }
    else c.drawImage(this.image, this.x, this.y, this.width, this.height)
  }
}

class Table extends ImageSprite{
  constructor(width, height, src, chairSize){
    super((canvas.width - width) / 2, (canvas.height - height) / 2, width, height, src)
    
    this.chairSpots = [[this.x + width*2/3 - chairSize/2, this.y+height+chairSize/3], [this.x + width*1/3 - chairSize/2, this.y+height+chairSize/3], [this.x - chairSize*3/2, this.y+height/2-chairSize/2], [this.x + width*1/3 - chairSize/2, this.y-chairSize*4/3], [this.x + width*2/3 - chairSize/2, this.y-chairSize*4/3], [this.x + width + chairSize/2, this.y+height/2-chairSize/2]]
  }

  draw(){
    this.drawn = true
    c.drawImage(this.image, this.x, this.y, this.width, this.height)
  }
}

class CardSprite extends ImageSprite {
  constructor(x, y, width, height, src, rotate=0){
    super(x, y, width, height, src, rotate=0)
    this.frontside = src
    this.backside = '/imgs/cards/cardback.png'
  }

  new_src(src){
    this.src = src
    this.image.src = src
  }

  flip(){
    if (this.src == this.frontside) this.new_src(this.backside)
    else if (this.src == this.backside) this.new_src(this.frontside)
  }
}

function cashToNumberConvertor(cash){
  let yourNumber = '5'
  Object.keys(cashToNumber).reverse().forEach((amount) => {
    if (cash < amount) yourNumber = cashToNumber[amount]
  })
  return yourNumber
}

function dealOutCards(){
  for (playerNum in otherPlayers){
    otherPlayerCards.push(new CardSprite(cardAroundSeatsPos[playerNum-1][0], cardAroundSeatsPos[playerNum-1][1], cardW, cardH, '/imgs/cards/cardback.png'))
    otherPlayerCards.push(new CardSprite(cardAroundSeatsPos[playerNum-1][0] + cardW + cardSpace, cardAroundSeatsPos[playerNum-1][1], cardW, cardH, '/imgs/cards/cardback.png'))
  }
  myCard1.x = cardAroundSeatsPos[myPlayer.playerNum-1][0], myCard1.y = cardAroundSeatsPos[myPlayer.playerNum-1][1]
  myCard2.x = cardAroundSeatsPos[myPlayer.playerNum-1][0] + cardW + cardSpace, myCard2.y = cardAroundSeatsPos[myPlayer.playerNum-1][1]
}

function reset(){
  console.log('reset!')
  // remove table cards

  // reseting game values

  potSize = 0
  knownCards = []

  playersLeft = []

  FPS = 15

  table = new Table(canvas.width* 2/3, (canvas.width * 2/3)/2, "/imgs/pokertable.png", chairSize)
  
  smallBind = new ImageSprite(-bindSize,-bindSize, bindSize, bindSize, '/imgs/small_bind.png')
  bigBind = new ImageSprite(-bindSize,-bindSize, bindSize, bindSize, '/imgs/big_bind.png')
  dealer = new ImageSprite(-bindSize,-bindSize, bindSize, bindSize, '/imgs/dealer.png')
  
  tableCardSprites = [new CardSprite(tableCardPos[0][0],tableCardPos[0][1],tableCardW,tableCardH,''), new CardSprite(tableCardPos[1][0],tableCardPos[1][1],tableCardW,tableCardH,''), new CardSprite(tableCardPos[2][0],tableCardPos[2][1],tableCardW,tableCardH,''), new CardSprite(tableCardPos[3][0],tableCardPos[3][1],tableCardW,tableCardH,''), new CardSprite(tableCardPos[4][0],tableCardPos[4][1],tableCardW,tableCardH,'')]
  
  myCard1 = new CardSprite(0,0,cardW,cardH,'');
  const myCard2 = new CardSprite(0,0,cardW,cardH,'');
  
  playerTags = []
  
  tagAura = new ImageSprite(-(playerTagWidth + playerTagWidth/10),-(playerTagHeight+ playerTagWidth/10),playerTagWidth + playerTagWidth/10, playerTagHeight+ playerTagWidth/10,'/imgs/tags/tag-aura.png');
  auracount = 0
  
  cursor = new ImageSprite(0,0,cursorWidth,cursorHeight,'');
  
  knockButton = new CardSprite(0,0,0,0,'');
  
  callButton = new ImageSprite(0,0,table.width/8 * 1.26,table.width/8,''); //1.26
  
  deck = new ImageSprite(0,0,tableCardW*1.078, tableCardH*1.145,'/imgs/cards/deck.png'); // 1.078x width, 1.145x height
  otherPlayerCards = []
  
  messages = []
  
  pot = new ImageSprite(0,0,table.width/6 * 1.26,table.width/6,'')
  
  raiseButton = new ImageSprite(-(callButton.width/5 * 1.859),-(callButton.width/5 * 1.859,callButton.width/5),callButton.width/5 * 1.859,callButton.width/5,'/imgs/raiseButton.png')
  
  raiseChips = []
  
  winnerMessage = ""
  beginWinWait = false
  winWaitMax = FPS * 60
  winWait = 0
  
  haveMadeMove = true
  canCheck = null
  isDraggingCards = false
  haveFolded = false
  displayRaiseChips = false
  firstTableMouseClick = null
  currentBetterNum = smallBindNumber
  
  fontSize = 30
}


//////////////////
// SETUP VARIABLES
var FPS = 15

const chairSize = canvas.width / 12; // 800/6
var table = new Table(canvas.width* 2/3, (canvas.width * 2/3)/2, "/imgs/pokertable.png", chairSize)

const chairs = []
for (let i=0; i<6; i++){
    let position = table.chairSpots[i];
    chairs.push(new ImageSprite(position[0], position[1], chairSize, chairSize, '/imgs/chair.png'))
    if (i==0 || i==1) chairs[i].rotate = 180
    else if (i==2) chairs[i].rotate = 270
    else if (i==5) chairs[i].rotate = 90
}

var bindSize = canvas.width/25
var smallBind = new ImageSprite(-bindSize,-bindSize, bindSize, bindSize, '/imgs/small_bind.png')
var bigBind = new ImageSprite(-bindSize,-bindSize, bindSize, bindSize, '/imgs/big_bind.png')
var dealer = new ImageSprite(-bindSize,-bindSize, bindSize, bindSize, '/imgs/dealer.png')

const tableCardW = table.width * (0.39/6.36), tableCardH = tableCardW * 460 / 300
const tableCardXStart = table.x + table.width*(3.985/6.36), tableCardYStart = table.y + table.height * (1/3.38)
const tableCardSpace = table.width * (0.11/6.36)
const tableCardPos = [[tableCardXStart, tableCardYStart], [tableCardXStart - tableCardW - tableCardSpace, tableCardYStart], [tableCardXStart - tableCardW*2 - tableCardSpace*2, tableCardYStart], [tableCardXStart - tableCardW*3 - tableCardSpace*3, tableCardYStart], [tableCardXStart - tableCardW*4 - tableCardSpace*4, tableCardYStart]]
var tableCardSprites = [new CardSprite(tableCardPos[0][0],tableCardPos[0][1],tableCardW,tableCardH,''), new CardSprite(tableCardPos[1][0],tableCardPos[1][1],tableCardW,tableCardH,''), new CardSprite(tableCardPos[2][0],tableCardPos[2][1],tableCardW,tableCardH,''), new CardSprite(tableCardPos[3][0],tableCardPos[3][1],tableCardW,tableCardH,''), new CardSprite(tableCardPos[4][0],tableCardPos[4][1],tableCardW,tableCardH,'')]

const cardW = tableCardW/1.25, cardH = tableCardH/1.25//table.width/12, cardH = cardW * 460 / 300
var myCard1 = new CardSprite(0,0,cardW,cardH,'');
var myCard2 = new CardSprite(0,0,cardW,cardH,'');
const cardSpace = cardW/10

const cardAroundSeatsPos = [[table.chairSpots[0][0] + chairSize/2 - cardW - cardSpace, table.chairSpots[0][1] - cardH],
                            [table.chairSpots[1][0] + chairSize/2 - cardW - cardSpace, table.chairSpots[1][1] - cardH],
                            [table.chairSpots[2][0] + chairSize, table.chairSpots[2][1] + chairSize/2 - cardH],
                            [table.chairSpots[3][0] + chairSize/2 - cardW - cardSpace, table.chairSpots[3][1] + chairSize],
                            [table.chairSpots[4][0] + chairSize/2 - cardW - cardSpace, table.chairSpots[4][1] + chairSize],
                            [table.chairSpots[5][0]-cardW*2-cardSpace, table.chairSpots[5][1] + chairSize/2 - cardH]
                          ]

const playerTagWidth = (464/2)/1600 * canvas.width
const playerTagHeight = (178/2)/1600 * canvas.width
var playerTags = []

var tagAura = new ImageSprite(-(playerTagWidth + playerTagWidth/10),-(playerTagHeight+ playerTagWidth/10),playerTagWidth + playerTagWidth/10, playerTagHeight+ playerTagWidth/10,'/imgs/tags/tag-aura.png');
var auracount = 0
const auraCountMax = FPS * 8 

const cursorWidth = (389/4)/1600 * canvas.width, cursorHeight = (508/4)/1600 * canvas.width
var cursor = new ImageSprite(0,0,cursorWidth,cursorHeight,'');

var knockButton = new CardSprite(0,0,0,0,'');

var callButton = new ImageSprite(0,0,table.width/8 * 1.26,table.width/8,''); //1.26

var deck = new ImageSprite(0,0,tableCardW*1.078, tableCardH*1.145,'/imgs/cards/deck.png'); // 1.078x width, 1.145x height
var otherPlayerCards = []

const messageW = playerTagWidth/1.5, messageH = messageW / 3.078 //3.078
var messages = []

var pot = new ImageSprite(0,0,table.width/6 * 1.26,table.width/6,'')

var raiseButton = new ImageSprite(-(callButton.width/5 * 1.859),-(callButton.width/5 * 1.859,callButton.width/5),callButton.width/5 * 1.859,callButton.width/5,'/imgs/raiseButton.png')

const raiseChipsW = raiseButton.width, raiseChipsH = raiseChipsW * 0.418
var raiseChips = []

var winnerMessage = ""
var beginWinWait = false
var winWaitMax = FPS * 60
var winWait = 0

var haveMadeMove = true
var canCheck = null
var isDraggingCards = false
var haveFolded = false
var displayRaiseChips = false
var firstTableMouseClick = null
var currentBetterNum = null

var fontSize = 30
//////////////////
//////////////////

function update(){
  let combinedPlayers = {...otherPlayers}
  combinedPlayers[myPlayer.playerNum] = myPlayer
  for (playerNum in combinedPlayers){
    
    if (playerNum == smallBindNumber) smallBind.x = table.chairSpots[playerNum-1][0] + chairSize, smallBind.y = table.chairSpots[playerNum-1][1] + chairSize - bindSize
    if (playerNum == bigBindNumber) bigBind.x = table.chairSpots[playerNum-1][0] + chairSize, bigBind.y = table.chairSpots[playerNum-1][1] + chairSize - bindSize
    if (playerNum == dealerNumber) dealer.x = table.chairSpots[playerNum-1][0] + chairSize, dealer.y = table.chairSpots[playerNum-1][1] + chairSize - bindSize
  }

  deck.setSize(tableCardW*1.078, tableCardH*1.145)
  deck.x = tableCardXStart + cardW + tableCardSpace*2, deck.y = table.y + table.height/2 - cardH/2

  if (Object.keys(myPlayer).length != 0){
    myCard1.x = cardAroundSeatsPos[myPlayer.playerNum-1][0], myCard1.y = cardAroundSeatsPos[myPlayer.playerNum-1][1]
    myCard2.x = cardAroundSeatsPos[myPlayer.playerNum-1][0] + cardW + cardSpace, myCard2.y = cardAroundSeatsPos[myPlayer.playerNum-1][1]

    callButton.setSize(table.width/6 * 1.26,table.width/6)
    callButton.x = canvas.width - callButton.width*1.2, callButton.y = canvas.height - callButton.height - canvas.height/15
    callButton.new_src('/imgs/call-buttons/call-button-' + cashToNumberConvertor(parseInt(myPlayer.cash)) + '.png')

    raiseButton.setSize(callButton.width/5 * 1.859,callButton.width/5)
    raiseButton.x = callButton.x + callButton.width/2 - raiseButton.width/2, raiseButton.y = callButton.y - raiseButton.height

    pot.x = table.x + table.width/2 - pot.width/2, pot.y = table.y + table.height/2 - pot.height/4
  }


  if (playerTags.length < Object.keys(combinedPlayers).length){
    playerTags.push(new ImageSprite(0,0,playerTagWidth,playerTagHeight, ''))
    messages.push(new ImageSprite(0,0,messageW,messageH,''))
  }

  // cursor switches
  document.body.style.cursor = 'auto';
  cursor.x = mousePos[0] - cursor.width/2, cursor.y = mousePos[1] - cursor.height/4

  if (myCard1.isTouching(...mousePos) && myCard1.drawn){
    document.body.style.cursor = 'none';
    cursor.new_src('/imgs/cursors/pointer.png')
    if (clicked) {
      myCard1.flip()
      clicked = false
    }
    else if (mouse_pressed){
      document.body.style.cursor = 'none'; // none vs auto
      cursor.new_src('/imgs/cursors/fist.png')
      isDraggingCards = true
    } 
    else isDraggingCards = false
  }
  else if (myCard2.isTouching(...mousePos) && myCard2.drawn){
    document.body.style.cursor = 'none';
    cursor.new_src('/imgs/cursors/pointer.png')
    if (clicked) {
      clicked = false
      myCard2.flip()
    }
    else if (mouse_pressed){
      document.body.style.cursor = 'none'; // none vs auto
      cursor.new_src('/imgs/cursors/fist.png')
      isDraggingCards = true
    } 
    else isDraggingCards = false
  }
  else if (callButton.isTouching(...mousePos) && callButton.drawn){
    callButton.setSize(callButton.width * 1.15, callButton.height*1.15)
    callButton.x = callButton.x - (callButton.width - callButton.width/1.15)/2, callButton.y = callButton.y - (callButton.height - callButton.height/1.15)/2 // no need to reset after mouse moves cause its done in the beginning of this functon
    
    document.body.style.cursor = 'none'; // none vs auto
    cursor.new_src('/imgs/cursors/pointer.png')

    if (clicked && !haveMadeMove){
      socket.emit('call')
      haveMadeMove = true
    }
  }
  else if (deck.isTouching(...mousePos) && deck.drawn && myPlayer.playerNum == dealerNumber){    
    deck.setSize(deck.width * 1.1, deck.height*1.1)
    deck.x = deck.x - (deck.width - deck.width/1.1)/2, deck.y = deck.y - (deck.height - deck.height/1.1)/2 // no need to reset after mouse moves cause its done in the beginning of this functon
    
    document.body.style.cursor = 'none'; // none vs auto
    cursor.new_src('/imgs/cursors/pointer.png')

    if (clicked){
      socket.emit('deck clicked')
    }
  }
  else if (knockButton.isTouching(...mousePos) && knockButton.drawn){
    document.body.style.cursor = 'none'; // none vs auto
    cursor.new_src('/imgs/cursors/fist.png')

    if (mouse_pressed) {
      cursor.setSize(cursorWidth/1.5,cursorHeight/1.5)
      cursor.x = mousePos[0] - cursor.width/2, cursor.y = mousePos[1] - cursor.height/4
    }
    else cursor.setSize(cursorWidth,cursorHeight)

    if (dblclicked && !haveMadeMove && canCheck) {
      socket.emit('check')
      haveMadeMove = true
      dblclicked = false
    }
    
    if (isDraggingCards && !mouse_pressed && !haveMadeMove){
      isDraggingCards = false
      haveMadeMove = true
      haveFolded = true
      socket.emit('fold')
    }
  }
  else if (table.isTouching(...mousePos) && table.drawn){
    document.body.style.cursor = 'none'; // none vs auto
    cursor.new_src('/imgs/cursors/fist.png')

    if (mouse_pressed) {
      cursor.setSize(cursorWidth/1.5,cursorHeight/1.5)
      cursor.x = mousePos[0] - cursor.width/2, cursor.y = mousePos[1] - cursor.height/4
    }
    else cursor.setSize(cursorWidth,cursorHeight)

    if (dblclicked && !haveMadeMove && canCheck) {
      socket.emit('check')
      haveMadeMove = true
      dblclicked = false
    }

    if (isDraggingCards && !mouse_pressed){
      isDraggingCards = false
    }

    if (displayRaiseChips){
      if (mouse_pressed && firstTableMouseClick == null){
        firstTableMouseClick = mousePos
      }
      else if (mouse_pressed){
        let diff = firstTableMouseClick[1] - mousePos[1]
        if (Math.round(diff / raiseChipsH) > raiseChips.length){
          let color = ""
          let randomNum = Math.random() * 10
          if (randomNum < 2) color = 'black'
          else if (randomNum < 4) color = 'blue'
          else if (randomNum < 6) color = 'green'
          else if (randomNum < 8) color = 'orange'
          else if (randomNum < 10) color = 'red'

          raiseChips.push(new ImageSprite(firstTableMouseClick[0], firstTableMouseClick[1] - raiseChipsH*raiseChips.length, raiseChipsW, raiseChipsH, '/imgs/poker-chips/poker-chip-'+color+'.png'))
        }
        else if (Math.round(diff / raiseChipsH) < raiseChips.length){
          while (Math.round(diff / raiseChipsH) < raiseChips.length){
            raiseChips.pop()
          }
        }
      }
      else if (!mouse_pressed && firstTableMouseClick != null){
        let finalMousePos = mousePos[1]
        let diff = firstTableMouseClick[1] - finalMousePos 

        let amountRaised = Math.round(diff / raiseChipsH) * (raiseChipsH / table.height) * myPlayer.cash
        
        if (!haveMadeMove)
          socket.emit('raise', (amountRaised))

        raiseChips = []

        haveMadeMove = true

        firstTableMouseClick = null
        displayRaiseChips = false
      }
    }
  }
  else if (raiseButton.isTouching(...mousePos) & raiseButton.drawn){
    raiseButton.setSize(raiseButton.width * 1.1, raiseButton.height*1.1)
    raiseButton.x = raiseButton.x - (raiseButton.width - raiseButton.width/1.1)/2, raiseButton.y = raiseButton.y - (raiseButton.height - raiseButton.height/1.1)/2 // no need to reset after mouse moves cause its done in the beginning of this functon
    
    document.body.style.cursor = 'none'; // none vs auto
    cursor.new_src('/imgs/cursors/pointer.png')

    if (clicked){
      displayRaiseChips = !displayRaiseChips
    }
  }

  clicked = false
  dblclicked = false

  if (!mouse_pressed) isDraggingCards = false

  if (isDraggingCards){
    myCard1.rotate = 30
    myCard2.rotate = -30
    myCard1.x = mousePos[0] - myCard1.width, myCard1.y = mousePos[1] - myCard1.height/2
    myCard2.x = mousePos[0], myCard2.y = mousePos[1] - myCard2.height/2

    if (!haveMadeMove){
      knockButton.new_src(knockButton.backside)
    }
  }
  else { // the positions are reset at the begining of this function so no need to do right it again it'll update the next frame
    myCard1.rotate = 0
    myCard2.rotate = 0
    knockButton.new_src(knockButton.frontside)
  }

  auracount ++
  if (auracount >= auraCountMax && Object.keys(myPlayer).length != 0){
    auracount = 0
    tagAura.needToDraw = !tagAura.needToDraw
  }
  else if (Object.keys(myPlayer).length == 0) tagAura.needToDraw=false

  if (beginWinWait){
    winWait ++
    if (winWait >= winWaitMax){
      beginWinWait = false
      reset()
    }
  }
  
}


let animationId;
function animate() {
  animationId = requestAnimationFrame(animate)

  update() // HERE IS WHERE THE LOGIC HAPPENS

  c.clearRect(0, 0, canvas.width, canvas.height)
  
  table.draw()

  chairs.forEach((chair) => {
    chair.draw()
  })

  if ((table.isTouching(...mousePos) && !haveMadeMove && canCheck) || (table.isTouching(...mousePos) && !haveMadeMove && isDraggingCards)){
    knockButton.draw()
  }
  else knockButton.drawn = false

  callButton.draw()
  c.fillStyle = 'orange'
  c.font = fontSize*2 + "px nunito";
  c.fillText('$' + Math.round(myPlayer.cash), callButton.x + (callButton.width-(fontSize * Math.floor(Math.log10(myPlayer.cash) + 2)))/2, callButton.y + callButton.height + fontSize)
  
  raiseButton.draw()

  pot.draw()
  c.fillText('$' + Math.round(potSize), pot.x + (pot.width-(fontSize * Math.floor(Math.log10(potSize) + 2)))/2, pot.y + pot.height + fontSize)
  
  let textPosAdjX = playerTagWidth / 2.5, textPosAdjY = fontSize*1.25

  if (tagAura.needToDraw)
    tagAura.draw()

  let playerTagIndex = 0;
  for (playerNum in otherPlayers){
    let playerTag = playerTags[playerTagIndex]

    if (!playersLeft.includes(otherPlayers[playerNum].playerNum)){
      let nameTagPos = table.chairSpots[playerNum-1]

      playerTag.x = nameTagPos[0] - playerTagWidth/2 + chairSize/2, playerTag.y = nameTagPos[1] + playerTagHeight/3
      if (otherPlayers[playerNum].tagColor != null) playerTag.new_src('/imgs/tags/tag-' + otherPlayers[playerNum].tagColor + '.png')
      else playerTag.new_src('/imgs/tags/tag-default.png')
      
      playerTag.draw()

      c.font = fontSize + "px nunito"; // nunito
      if (otherPlayers[playerNum].tagColor != null) c.fillStyle = otherPlayers[playerNum].tagColor
      else c.fillStyle = 'orange'

      if (fontSize * otherPlayers[playerNum].name.length > playerTag.width){
        c.fillText(otherPlayers[playerNum].name.substring(0, Math.round(playerTag.width / fontSize)-1)+"..", playerTag.x+textPosAdjX, playerTag.y+textPosAdjY);
        c.font = (fontSize+1) + "px nunito";
        c.strokeText(otherPlayers[playerNum].name.substring(0, Math.round(playerTag.width / fontSize)-1)+"..", playerTag.x+textPosAdjX, playerTag.y+textPosAdjY);
      } 
      else {
        c.fillText(otherPlayers[playerNum].name, playerTag.x+textPosAdjX, playerTag.y+textPosAdjY)
        c.font = (fontSize+1) + "px nunito";
        c.strokeText(otherPlayers[playerNum].name, playerTag.x+textPosAdjX, playerTag.y+textPosAdjY)
      }
      
      c.fillStyle = 'black'
      c.font = fontSize/2 + 'px nunito'
      c.fillText('Cash: ' + Math.round(otherPlayers[playerNum].cash), playerTag.x+textPosAdjX, playerTag.y+fontSize+textPosAdjY)

      message = messages[playerTagIndex]
      if (playerNum == 1 || playerNum == 2) {
        message.x = playerTag.x + playerTag.width - smallBind.width/3, message.y = playerTag.y + playerTag.height/2 - playerTag.height + smallBind.height/3
        if (otherPlayers[playerNum].tagColor != null) message.new_src('/imgs/messages/message-' + otherPlayers[playerNum].tagColor + '-normal' + '.png')
        else message.new_src('/imgs/messages/message-' + 'default' + '-normal' + '.png')
      }
      else if (playerNum == 4 || playerNum == 5) {
        message.x = playerTag.x + smallBind.width/3 - messageW, message.y = playerTag.y + playerTag.height - smallBind.height/3
        if (otherPlayers[playerNum].tagColor != null) message.new_src('/imgs/messages/message-' + otherPlayers[playerNum].tagColor + '-upside' + '.png')
        else message.new_src('/imgs/messages/message-' + 'default' + '-upside' + '.png')
      }
      else if (playerNum == 3) {
        message.x = playerTag.x + playerTag.width - message.width - smallBind.width/1.5, message.y = playerTag.y + playerTag.height - smallBind.height/5
        if (otherPlayers[playerNum].tagColor != null) message.new_src('/imgs/messages/message-' + otherPlayers[playerNum].tagColor + '-upside' + '.png')
        else message.new_src('/imgs/messages/message-' + 'default' + '-upside' + '.png')
      }
      else if (playerNum == 6) {
        message.x = playerTag.x - message.width + smallBind.width/1.5, message.y = playerTag.y + playerTag.height - smallBind.height/5
        if (otherPlayers[playerNum].tagColor != null) message.new_src('/imgs/messages/message-' + otherPlayers[playerNum].tagColor + '-upside' + '.png')
        else message.new_src('/imgs/messages/message-' + 'default' + '-upside' + '.png')
      }

      if (otherPlayers[playerNum].action != 'none') {
        message.draw()

        c.font = fontSize*4/5 + "px roboto"; // nunito
        if (otherPlayers[playerNum].tagColor != null) c.fillStyle = otherPlayers[playerNum].tagColor
        else c.fillStyle = 'orange'

        let messageTextPos = []
        if (playerNum <= 2) messageTextPos = [message.x + fontSize/2, message.y + message.height/2]
        else messageTextPos = [message.x + fontSize/2, message.y + message.height/2 + fontSize/2]
  
        if (otherPlayers[playerNum].action == 'raise') c.fillText('Raise: $' + otherPlayers[playerNum].bet, messageTextPos[0], messageTextPos[1]);
        else c.fillText(otherPlayers[playerNum].action.substring(0,1).toUpperCase() + otherPlayers[playerNum].action.substring(1), messageTextPos[0], messageTextPos[1]);
      }

      if (playerNum == currentBetterNum){
        tagAura.x = playerTag.x - (tagAura.width - playerTag.width)/2, tagAura.y = playerTag.y - (tagAura.height - playerTag.height)/2
      }
      
      playerTagIndex++;
    }
  }

  let playerTag = playerTags[playerTagIndex]
  if (Object.keys(myPlayer).length != 0){// testing to see if myPlayer has even been defined yet
    playerTag.x = table.chairSpots[myPlayer.playerNum-1][0] - playerTagWidth/2 + chairSize/2, playerTag.y = table.chairSpots[myPlayer.playerNum-1][1] + playerTagHeight/3

    if (myPlayer.tagColor != null) playerTag.new_src('/imgs/tags/tag-' + myPlayer.tagColor + '.png')
    else playerTag.new_src('/imgs/tags/tag-default.png')
    
    playerTag.draw()

    c.font = fontSize + "px nunito"; // nunito
    if (myPlayer.tagColor != null) c.fillStyle = myPlayer.tagColor
    else c.fillStyle = 'orange'

    if (fontSize * myPlayer.name.length > playerTag.width) {
      c.fillText(myPlayer.name.substring(0, Math.round(playerTag.width / fontSize)-1)+"..", playerTag.x+textPosAdjX, playerTag.y+textPosAdjY);
      c.font = (fontSize+1) + "px nunito";
      c.strokeText(myPlayer.name.substring(0, Math.round(playerTag.width / fontSize)-1)+"..", playerTag.x+textPosAdjX, playerTag.y+textPosAdjY);
    }
    else {
      c.fillText(myPlayer.name, playerTag.x+textPosAdjX, playerTag.y+textPosAdjY)
      c.font = (fontSize+1) + "px nunito";
      c.strokeText(myPlayer.name, playerTag.x+textPosAdjX, playerTag.y+textPosAdjY)
    }
    
    
    c.fillStyle = 'black'
    c.font = fontSize/2 + 'px nunito'
    c.fillText('Cash: ' + Math.round(myPlayer.cash), playerTag.x+textPosAdjX, playerTag.y+fontSize+textPosAdjY)

    c.fillText('Wins: ' + myPlayer.wins, 0, fontSize*2)

    
    message = messages[playerTagIndex]
    if (myPlayer.playerNum == 1 || myPlayer.playerNum == 2) {
      message.x = playerTag.x + playerTag.width - smallBind.width/3, message.y = playerTag.y + playerTag.height/2 - playerTag.height + smallBind.height/3
      if (myPlayer.tagColor != null) message.new_src('/imgs/messages/message-' + myPlayer.tagColor + '-normal' + '.png')
      else message.new_src('/imgs/messages/message-' + 'default' + '-normal' + '.png')
    }
    else if (myPlayer.playerNum == 4 || myPlayer.playerNum == 5) {
      message.x = playerTag.x + smallBind.width/3 - messageW, message.y = playerTag.y + playerTag.height - smallBind.height/3
      if (myPlayer.tagColor != null) message.new_src('/imgs/messages/message-' + myPlayer.tagColor + '-upside' + '.png')
      else message.new_src('/imgs/messages/message-' + 'default' + '-upside' + '.png')
    }
    else if (myPlayer.playerNum == 3) {
      message.x = playerTag.x + playerTag.width - message.width - smallBind.width/1.5, message.y = playerTag.y + playerTag.height - smallBind.height/5
      if (myPlayer.tagColor != null) message.new_src('/imgs/messages/message-' + myPlayer.tagColor + '-upside' + '.png')
      else message.new_src('/imgs/messages/message-' + 'default' + '-upside' + '.png')
    }
    else if (myPlayer.playerNum == 6) {
      message.x = playerTag.x - message.width + smallBind.width/1.5, message.y = playerTag.y + playerTag.height - smallBind.height/5
      if (myPlayer.tagColor != null) message.new_src('/imgs/messages/message-' + myPlayer.tagColor + '-upside' + '.png')
      else message.new_src('/imgs/messages/message-' + 'default' + '-upside' + '.png')
    }

    if (myPlayer.action != 'none'){
      message.draw()

      c.font = fontSize*4/5 + "px roboto"; // nunito
      if (myPlayer.tagColor != null) c.fillStyle = myPlayer.tagColor
      else c.fillStyle = 'orange'

      let messageTextPos = []
      if (myPlayer.playerNum <= 2) messageTextPos = [message.x + fontSize/2, message.y + message.height/2]
      else messageTextPos = [message.x + fontSize/2, message.y + message.height/2 + fontSize/2]

      if (myPlayer.action == 'raise') c.fillText('Raise: $' + myPlayer.bet, messageTextPos[0], messageTextPos[1]);
      else c.fillText(myPlayer.action.substring(0,1).toUpperCase() + myPlayer.action.substring(1), messageTextPos[0], messageTextPos[1]);
    }

    if (myPlayer.playerNum == currentBetterNum){
      tagAura.x = playerTag.x - (tagAura.width - playerTag.width)/2, tagAura.y = playerTag.y - (tagAura.height - playerTag.height)/2
    }
  }

  smallBind.draw()
  bigBind.draw()
  dealer.draw()

  if (Object.keys(myPlayer).length != 0 && myPlayer.cards.length != 0){
    if (!haveFolded){
      myCard1.draw()
      myCard2.draw()
    }
    else{
      myCard1.drawn = false
      myCard2.drawn = false
    }
  }

  for (let i=0; i<knownCards.length; i++){
    tableCardSprites[i].draw()
  }

  otherPlayerCards.forEach((card) => {
    if (Object.keys(otherPlayers).length != 0){
      card.draw()
    }    
  })

  deck.draw()

  raiseChips.forEach((chip) => {chip.draw()})

  if (winnerMessage != ""){
    let fontSizeWinner = canvas.width/winnerMessage.length/2
    c.fillStyle = 'orange'
    c.font = fontSizeWinner + 'px roboto'
    c.fillText(winnerMessage, canvas.width/2-(fontSizeWinner * winnerMessage.length)/4, canvas.height/2)
  }


  if (cursor.src != '') cursor.draw()

}

var mousePos = [] //x,y
var mouse_pressed = false
var clicked = false
var dblclicked = false

canvas.addEventListener("mousemove", function (e) {
  let rect = canvas.getBoundingClientRect();
  let x = e.clientX - rect.left;
  let y = e.clientY - rect.top;

  mousePos = [x,y]
}); 

canvas.addEventListener("mouseup", function (e) {
  mouse_pressed = false
});
canvas.addEventListener("mousedown", function (e) {
  mouse_pressed = true
});
canvas.addEventListener("click", function (e) {
  clicked = true
});
canvas.addEventListener("dblclick", function (e) {
  dblclicked = true
});



animate()






// TODO: fix call for bigBind/smallBind on first round
// create a more interactive way to call, fold, raise than buttons
// perhaps you have to drag your cards to the table to fold, or click on your chips to call, or double tap on chips to raise, check can just be a button or smt 
