const socket = io();

var roomsKnown = []

localStorage.setItem('sessionID', null)
socket.emit('start-session', null)

socket.on('set-session-acknowledgement', (sessionID) => {
  localStorage.setItem('sessionID', sessionID)
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
/////////////////////////////


// Display functions
function updateRooms(addRoom, room){
    if (addRoom){
        const newRoom = document.createElement('button')
        newRoom.classList.add("pickRoomButton")
        newRoom.textContent = room.name
        newRoom.style = "cursor: pointer; background-color: red; border:10px solid rgb(0,0,255); margin: 5px;"
        
        let roomSelector = document.querySelector('#roomsDiv');
        roomSelector.appendChild(newRoom)
  
        newRoom.addEventListener('click', function(){
          socket.emit('join room', room.name)
        })
    }
}

////////////////////



// Listener Functions
function homePageListeners(){
  
}
/////////////////////

homePageListeners()