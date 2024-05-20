// const canvas = document.querySelector('canvas')
// const c = canvas.getContext('2d')

const socket = io()

var mySessionID = localStorage.getItem('sessionID')
socket.emit('start-session', mySessionID)

socket.on('set-session-acknowledgement', (sessionID) => {
  localStorage.setItem('sessionID', sessionID)
})

var frontEndUsers = {};

var myPlayer = {}
var otherPlayers = {} // otherPlayers[playerNum] = {"cash":0, "action":0}
var knownCards = []

function getPlayerIDFromPlayerNum(playerNum){
  for (ID in otherPlayers)
      if (otherPlayers[ID].playerNum == playerNum) return ID
}


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
  document.querySelector('#playerNumTag').textContent = "My Player Number: " + myPlayer.playerNum

  let playerInfoElement = document.querySelector('#playerInfo')
  playerInfoElement.innerHTML = ""
  for (playerID in otherPlayers){
    let newElement = document.createElement('p')
    newElement.textContent = "Player #" + playerID + " Status: " + otherPlayers[playerID].action
    playerInfoElement.appendChild(newElement)
  }
})


socket.on('small bind', (smallBindNumber) => {
   if (smallBindNumber == myPlayer.playerNum){
       document.querySelector('#smallBindTag').textContent = "Small Bind: Me!"
       // have some chip animation occur
   }
   else
       document.querySelector('#smallBindTag').textContent = "Small Bind: Player #" + smallBindNumber
})
socket.on('big bind', (bigBindNumber) => {
  if (bigBindNumber == myPlayer.playerNum){
    document.querySelector('#bigBindTag').textContent = "Big Bind: Me!"
    // have some chip animation occur
  }
  else
    document.querySelector('#bigBindTag').textContent = "Big Bind: Player #" + bigBindNumber
})
socket.on('dealer', (dealerNumber) => {
  if (dealerNumber == myPlayer.playerNum){
    document.querySelector('#dealerTag').textContent = "Dealer: Me!"
    // have some chip animation occur
  }
  else
    document.querySelector('#dealerTag').textContent = "Dealer: Player #" + dealerNumber
})




socket.on('deal 2 cards', () => {
  // animation of cards
  document.querySelector('#myCard1').textContent = myPlayer.cards[0].value + " of " + myPlayer.cards[0].suit
  document.querySelector('#myCard2').textContent = myPlayer.cards[1].value + " of " + myPlayer.cards[1].suit
  // BUT no need to edit the myPlayer, that will already be updated!
})




socket.on('ask bets', (currentCall) => {
  hideActionButtons()
  console.log('Current Call: ' + currentCall)
  if (currentCall > 0 && myPlayer.status != 'folded'){
    let callAmountTag = document.querySelector('#callAmountTag')
    callAmountTag.textContent = "Call: $" + currentCall
    callAmountTag.style.display = 'block'
    document.querySelector('#callButton').style.display = 'block'
    document.querySelector('#foldButton').style.display = 'block'
    if (myPlayer.cash > 0) document.querySelector('#raiseButton').style.display = 'block'
  }
  else if (myPlayer.status != 'folded'){
    document.querySelector('#checkButton').style.display = 'block'
    document.querySelector('#foldButton').style.display = 'block'
    if (myPlayer.cash > 0) document.querySelector('#raiseButton').style.display = 'block'
  }
})


socket.on('pot size', (amount) => {
  document.querySelector('#potTag').textContent = "Pot: $" + amount
})


socket.on('reveal table cards', (allTableCards) => {

  allTableCards.forEach((card) => {
      cardString = card.value + ' of ' + card.suit
      if (!knownCards.includes(cardString)){
          knownCards.push(cardString)

          const cardTag = document.createElement('p')
          cardTag.textContent = cardString //myPlayer.cards[0].value + " of " + myPlayer.cards[0].suit

          document.querySelector('#tableCards').appendChild(cardTag)
      }
  })
})


socket.on('winner', (winnerNum) => {
  // winner animation for self and for others
  let winnerTag = document.querySelector('#winnerTag')
  if (winnerNum == myPlayer.playerNum){
      winnerTag.style.display = 'block'
      winnerTag.textContent = "You Won!"
  }
  else {
      winnerTag.style.display = 'block'
      winnerTag.textContent = "Player #" + winnerNum + " won..."
  }
})


socket.on('reset', () => {
  // remove table cards
  let tableCards = document.querySelector('#tableCards')
  while (tableCards.hasChildNode()){
      tableCards.removeChild()
  }
  // Removing display values
  document.querySelector('#dealerTag').textContent = "Dealer: "
  document.querySelector('#smallBindTag').textContent = "Small Bind: "
  document.querySelector('#bigBindTag').textContent = "Big Bind: "
  document.querySelector('#myCard1').textContent = ""
  document.querySelector('#myCard2').textContent = ""
  document.querySelector('#potTag').textContent = "Pot: $0"
  document.querySelector('#winnerTag').style.display = 'none'


  // reseting game values
  myPlayer = {}
  otherPlayers = {} // otherPlayers[playerNum] = {"cash":0, "action":0}
  knownCards = []
})




// Event Listeners
function hideActionButtons(){
  document.querySelector('#checkButton').style.display = 'none'
  document.querySelector('#callButton').style.display = 'none'
  document.querySelector('#foldButton').style.display = 'none'
  document.querySelector('#raiseButton').style.display = 'none'
  document.querySelector('#callAmountTag').style.display = 'none'
}
document.querySelector('#callButton').addEventListener('click', function(){
  hideActionButtons()
  socket.emit('call')
})
document.querySelector('#checkButton').addEventListener('click', function(){
  hideActionButtons()
  socket.emit('check')
})
document.querySelector('#foldButton').addEventListener('click', function(){
  hideActionButtons()
  socket.emit('fold')
})
document.querySelector('#raiseButton').addEventListener('click', function(){
  hideActionButtons()
  document.querySelector('#raiseForm').style.display = 'block'
})


document.querySelector('#raiseForm').addEventListener('submit', (e) => {
  e.preventDefault()
  socket.emit('raise', document.querySelector('#raiseFormInput').value)
  document.querySelector('#raiseForm').style.display = 'none'
})








document.querySelector('#startButton').addEventListener('click', function(){
  socket.emit('startGame')
})




// TODO: fix call for bigBind/smallBind on first round
// create a more interactive way to call, fold, raise than buttons
// perhaps you have to drag your cards to the table to fold, or click on your chips to call, or double tap on chips to raise, check can just be a button or smt 
