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

// Imports
const SteamUser = require('steam-user'),
    SteamTotp = require('steam-totp'),
    player = require('play-sound')(opts = {}),
    fs = require('fs'),
    express = require('express'),
    app = express(),
    server = require('http').Server(app),
    io = require('socket.io')(server);

// Stores log messages.
let logMessages = [];

// Function for emitting a log message.
function emitLog(message) {
    console.log(message);
    io.emit('log', message);

    logMessages.push(message);
    logMessages.slice(0, 100); // Maximum of 100 messages stored.
}

emitLog(' > Custom Steam bot made by Sulphate. [v1.1]');

//
// STEAM BOT SECTION
//

// Load the options.
let settings;

try {
    settings = require('./settings.json');
}
catch (err) {
    emitLog(' > Could not load the settings file. (Invalid JSON)');
    process.exit(1);
}

// Load bot data.
let data;

try {
    data = require('./data.json');
}
catch (err) {
    emitLog(' > Data file not found, creating empty one.');
    let emptyData = '{"userList":[]}';
    fs.writeFileSync('data.json', emptyData, 'utf-8');

    data = {
        userList: []
    };
}

// Check for required details.
if (!settings.username || !settings.password) {
    emitLog(' > Please make sure you have put a username and password in the settings.json file.');
    process.exit(1);
}

let message = settings.message || 'Hello there! I\'m not here right now, I\'ll get back to you soon :)';
if (!settings.message) {
    emitLog(' > No custom message set, using default.');
}

// Remove friends after this amount of time (if settings.removeOnAdd is true).
let removeAfterTime = settings.removeAfterTime || 0;

// Create login options object.
let loginOptions = {
    accountName: settings.username,
    password: settings.password
};

// Add the auth code if they are using the secret.
if (settings.sharedSecret !== "") {
    loginOptions.twoFactorCode = SteamTotp.generateAuthCode(settings.sharedSecret);
}

let user = new SteamUser();

// Log in to Steam.
user.logOn(loginOptions);
user.on('loggedOn', () => {

    // Update user settings.
    user.setPersona(SteamUser.EPersonaState.Online);
    if (!settings.game) {
        emitLog(' > No game set, not setting a played game.');
    }
    else {
        user.gamesPlayed(settings.game);
    }

    if (settings.autoMessageEnabled) {
    	emitLog(' > Responding automatically to messages.');
    }
    else {
    	emitLog(' > Not currently automatically responding to messages.');
    }

    let messagePart = settings.removeOnAdd ? '' : 'not ';
    emitLog(' > Friends are ' + messagePart + 'currently being removed after accepting.');

    if (settings.removeOnAdd) {
        emitLog(' > Friends will be removed ' + (removeAfterTime === 0 ? 'instantly.' : 'after ' + removeAfterTime + ' minutes.'));
    }

    emitLog(' > Successfully logged in to Steam, waiting for friend requests.');
});

// Log back in if the session expires.
user.on('sessionExpired', () => {
    user.webLogOn();
});

// Listen to friend messages.
user.on('friendMessage', sid => {
	// Respond automatically if set to do so.
	if (settings.autoMessageEnabled) {
		user.chatMessage(sid, settings.autoMessage);
	}
});

// Function for processing a friend request.
function processFriend(id, counter) {
    let removeFriend = (id, name) => {
        user.removeFriend(id);
        emitLog(' > Removed \'' + name + '\' successfully.');
    }

    user.addFriend(id, (err, name) => {
        if (err) {
            if (counter === 9) {
                emitLog(' > 10 consecutive errors adding a friend, waiting 5 minutes and trying again.');
                setTimeout(() => {
                    processFriend(id);
                }, 5 * 60 * 1000);
            }

            emitLog(err);
            emitLog(' > Failed to add a friend, trying again.');
            setTimeout(() => {
                processFriend(id, counter ? counter + 1 : 1);
            }, 2500);

        }
        else {
            emitLog(' > Accepted friend request from \'' + name + '\' (' + id + ').');

            // Play the notification sound if set in the settings.
            if (settings.playSound) {
                player.play('./resources/notification.mp3', err => {
                    emitLog(' > Failed to play notification sound.');
                });
            }

            // Send the chat message and remove them (if set).
            user.chatMessage(id, message);

            if (settings.removeOnAdd) {

                if (removeAfterTime <= 0) {
                    removeFriend(id, name);
                }

                if (data.userList.indexOf(id.getSteamID64()) === -1) {
                    // Add the user to the users list and save the data file.
                    data.userList.push(id.getSteamID64());
                    fs.writeFileSync('data.json', JSON.stringify(data), 'utf-8');

                    //Remove them after the set amount of minutes.
                    emitLog(' > Removing \'' + name + '\' after ' + removeAfterTime + ' minutes.');
                    setTimeout(() => {
                        removeFriend(id, name);
                    }, removeAfterTime * 60 * 1000);
                }
            }
        }
    });
}

// Listen for new friend requests.
user.on('friendRelationship', async(sid, relationship) => {
    if (relationship === 2) {

        // Process the friend request.
        processFriend(sid);

    }
});

//
// WEB APP SECTION
//

// View Engine
app.set('view engine', 'pug');

// Static Content
app.use(express.static('static'));

// Routes
app.get('*', (req, res) => {
    res.render('index');
});

// Listen for connections.
server.listen(process.env.PORT || 8080, process.env.IP || '0.0.0.0', () => {
    emitLog(' > Web app is now running.');
});

//
// SOCKET.IO SECTION
//

// Function for saving the settings to a file.
function saveSettings() {
    let data = JSON.stringify(settings, null, 4);
    fs.writeFileSync('./settings.json', data, 'utf-8');
}

io.on('connection', socket => {

    socket.on('get data', () => {
        socket.emit('data', {
            message: message,
            game: settings.game || 'None',
            logMessages: logMessages,
            removeOnAdd: !!settings.removeOnAdd,
            removeAfterTime: removeAfterTime,
            autoMessageEnabled: settings.autoMessageEnabled,
            autoMessage: settings.autoMessage
        });
    });

    socket.on('update message', newMessage => {
        if (!newMessage || newMessage.length < 1) {
            emitLog(' > Received invalid new message.');

        }
        else {
            message = newMessage;
            settings.message = newMessage;
            saveSettings();

            emitLog(' > Updated the message to: \'' + newMessage + '\'.');
        }
    });

    socket.on('update game', newGame => {
        if (!newGame || newGame.length < 1) {
            emitLog(' > Received invalid new game.');

        }
        else {
            settings.game = newGame;
            user.gamesPlayed(newGame);
            saveSettings();

            emitLog(' > Updated the game played to: \'' + newGame + '\'.');
        }
    });

    socket.on('update remove on add', shouldRemove => {
        settings.removeOnAdd = shouldRemove;
        saveSettings();

        let messagePart = shouldRemove ? '' : 'not ';
        emitLog(' > Friends are now ' + messagePart + 'being removed after accepting.');
    });
    
    socket.on('update remove after time', time => {
        removeAfterTime = time;
        settings.removeAfterTime = time;
        saveSettings();
        
        emitLog(' > Friends are now being removed after ' + time + ' minutes.');
    });

    socket.on('update auto send message enabled', shouldSend => {
    	settings.autoMessageEnabled = shouldSend;
    	saveSettings();

    	let messagePart = shouldSend ? '' : 'not ';
    	emitLog(' > Bot will now ' + messagePart + 'respond automatically with a message.');
    });

    socket.on('update auto send message', message => {
    	settings.autoMessage = message;
    	saveSettings();

    	emitLog(' > Now responding with the message \'' + message + '\'.');
    });
});
