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



// UPDATING VARIABLES FROM BACKEND
///////////////////////////////

socket.on('updateRooms', (backendRooms) => {
  backendRooms.forEach((backendRoom) => {
    let nameOfRoomsKnown = []
    roomsKnown.forEach((room)=>{ nameOfRoomsKnown.push(room.name) })
      if (!nameOfRoomsKnown.includes(backendRoom.name)){ // add new rooms
        roomsKnown.push(backendRoom)
        updateRooms(true, backendRoom)
      }
  })

  roomsKnown.forEach((frontendRoom) => {
    let nameOfbackEndRooms = []
    backendRooms.forEach((room)=>{ nameOfbackEndRooms.push(room.name) })
    if (!nameOfbackEndRooms.includes(frontendRoom.name)){ // add new rooms
      roomsKnown.splice(roomsKnown.indexOf(frontendRoom), 1)
      updateRooms(false, frontendRoom)
    }
  })
})

socket.on('joinRoom', (roomName) => {
  document.querySelector('#roomsAlert').textContent = ''
    window.location.href = "/room/" + roomName;
})
socket.on('room full', () => {
  document.querySelector('#roomsAlert').textContent = 'room full'
})
socket.on('must log in', () => {
  document.querySelector('#roomsAlert').textContent = 'Must Log In To Join/Create Rooms'
})

/////////////////////////////


// Display functions
function updateRooms(addRoom, room){
    if (addRoom){
        const newRoom = document.createElement('li')
        
        const newRoomSpan =  document.createElement('span')
        newRoomSpan.textContent = room.name
        const newRoomButton =  document.createElement('button')
        newRoomButton.textContent = 'Join'
        newRoom.appendChild(newRoomSpan)
        newRoom.appendChild(newRoomButton)

        newRoomButton.classList.add("pickRoomButton")
        newRoom.classList.add('room-item')
        
        let roomSelector = document.querySelector('.room-list');
        roomSelector.appendChild(newRoom)
  
        newRoomButton.addEventListener('click', function(){
          socket.emit('join room', room.name)
        })
    }
}

////////////////////



// Listener Functions
function pageListeners(){
  document.querySelector('#addRoomButton').addEventListener('click', function(){
    let addRoomForm = document.querySelector('#addRoomForm')
    if (addRoomForm.style.display == "block")
      addRoomForm.style.display = 'none'
    else
      addRoomForm.style.display = 'block'
  })

  document.querySelector('#addRoomForm').addEventListener('submit', (e) => {
    e.preventDefault()
    let addRoomForm = document.querySelector('#addRoomForm')
    addRoomForm.style.display = 'none'
    
    socket.emit('addRoom', (document.querySelector('#addRoomInput').value))

    document.querySelector('#addRoomInput').value = ""
  })
}
/////////////////////

pageListeners()