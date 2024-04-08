const canvas = document.querySelector('canvas')
const c = canvas.getContext('2d')

const socket = io()

var frontEndUsers = {};

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




document.querySelector('#startButton').addEventListener('click', function(){
    document.querySelector('#startButton').style.display = 'none'
    socket.emit('startGame')
})

