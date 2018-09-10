/*
Licensed under the MIT License (https://opensource.org/licenses/MIT)

Copyright 2018 © Matthew Lester <mjflester@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files
(the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify,
merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished
to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

// Elements

// Message & Game Inputs
let messageInput = document.getElementById('message-input');
let gameInput = document.getElementById('game-input');

// Live Feed
let liveFeed = document.getElementById('live-feed');

// Time Controls and Inputs
let timeControl = document.getElementById('time-control');
let timeInput = document.getElementById('time-input');
let timeCheckBox = document.getElementById('time-checkbox');
let timeSlider = document.getElementsByClassName('slider')[0];

// Auto Message Controls and Inputs
let autoMessageControl = document.getElementById('auto-message-control');
let autoMessageInput = document.getElementById('auto-message-input');
let autoMessageCheckbox = document.getElementById('auto-message-checkbox');
let autoMessageSlider = document.getElementsByClassName('slider')[1];

// Variables
let shouldEmitTime = false;
let shouldEmitMessage = false;

// Tells the server to update the message to a given value.
function updateMessage() {
    let message = messageInput.value;
    if (message.length < 1) {
        alert('Please enter a message to send.');    
    }
    else {
        socket.emit('update message', message);
    }
}

// Tells the server to update the game being played.
function updateGame() {
    let game = gameInput.value;
    if (game.length < 1) {
        alert('Please enter a game to set.');
    }
    else {
        if (!isNaN(game)) {
            game = parseInt(game, 10);
        }
        
        socket.emit('update game', game);
    }
}

// Tells the server to update friends being removed when accepted, also shows the time control.
function updateRemoveOnAdd() {
    if (shouldEmitTime) {
        socket.emit('update remove on add', timeCheckBox.checked);
    }
    else {
        shouldEmitTime = true;
    }
    timeControl.style = 'opacity: ' + (timeCheckBox.checked ? '1' : '0');
}

// Tells the server to update the remove after time to the provided value.
function updateRemoveAfterTime() {
    let time = timeInput.value;
    if (isNaN(time) || time < 0) {
        appendLog('Please enter a valid number.');        
    }
    else {
        socket.emit('update remove after time', parseInt(time, 10))
    }
}

// Tells the server to update automatically responding with a messagem, when messaged.
function updateAutoMessageEnabled() {
	if (shouldEmitMessage) {
		socket.emit('update auto send message enabled', autoMessageCheckbox.checked);
	}
	else {
		shouldEmitMessage = true;
	}
	autoMessageControl.style = 'opacity: ' + (autoMessageCheckbox.checked ? '1' : '0');
}

// Tells the server to update the message that will be sent automatically.
function updateAutoMessage() {
	let autoMessage = autoMessageInput.value;
	if (!autoMessage) {
		appendLog('Please enter a message to respond with.');
	}
	else {
		socket.emit('update auto send message', autoMessage);
	}
}

// Sets values of input elements and the live feed when data has been received.
socket.on('data', data => {
    let message = data.message;
    let game = data.game;
    let logMessages = data.logMessages;
    let removeOnAdd = data.removeOnAdd;
    let removeAfterTime = data.removeAfterTime;
    let autoMessageEnabled = data.autoMessageEnabled;
    let autoMessage = data.autoMessage;
    
    messageInput.value = message;
    gameInput.value = game;
    
    liveFeed.value += ' > Connected to server.\n';
    logMessages.forEach(message => {
        liveFeed.value += message + '\n';
    });
    liveFeed.scrollTop = liveFeed.scrollHeight;
    
	let clickEvent = new MouseEvent('click', {
        view: window,
        bubbles: true,
        cancelable: true
    });

    if (removeOnAdd) {
        timeSlider.dispatchEvent(clickEvent);
        timeInput.style = 'opacity: 1';
    }
    else {
    	shouldEmitTime = true;
    }

    if (autoMessageEnabled) {
    	autoMessageSlider.dispatchEvent(clickEvent);
    	autoMessageInput.style = 'opacity: 1';
    }
    else {
    	shouldEmitMessage = true;
    }
    
    timeInput.value = removeAfterTime;
    autoMessageInput.value = autoMessage;
});

// Appends a log to the live feed.
function appendLog(message) {
	liveFeed.value += message + '\n';
	liveFeed.scrollTop = liveFeed.scrollHeight;
}

// Logs messages when they come from the server.
socket.on('log', appendLog);

// Request for data from the server.
socket.emit('get data');