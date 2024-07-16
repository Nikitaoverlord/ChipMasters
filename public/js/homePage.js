const socket = io();

var roomsKnown = []

window.onpageshow = function(event) {
  if (event.persisted) {
      window.location.reload() 
  }
};

localStorage.setItem('sessionID', null)
socket.emit('start-session', null)

socket.on('set-session-acknowledgement', (sessionID) => {
  localStorage.setItem('sessionID', sessionID)
})

socket.on('give account info', () => {
  socket.emit('initial account info', [localStorage.getItem('email'), localStorage.getItem('password')])
})

socket.on('logged in', ()=>{
  console.log('logged in!')
})



// Listener Functions
function homePageListeners(){
  // document.querySelector('#loginButton').addEventListener('click', function(){
    
  // })
}
/////////////////////

homePageListeners()