// Import Firebase SDK functions needed for the project
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDocs, doc, setDoc, onSnapshot, getDoc, deleteDoc } from 'firebase/firestore';

// Firebase configuration for initializing the app
const firebaseConfig = {
    apiKey: "AIzaSyD5Wwi8cw3-IBKAqrFcKERbfK-QxTniWh8",
    authDomain: "cluedo-8eafb.firebaseapp.com",
    databaseURL: "https://cluedo-8eafb-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "cluedo-8eafb",
    storageBucket: "cluedo-8eafb.firebasestorage.app",
    messagingSenderId: "290841115510",
    appId: "1:290841115510:web:1c1f3dc0a6387bafd49857"
};

// Initialize Firebase app and get Firestore database reference
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Game variables for room code and lists of suspects, weapons, and rooms
let roomCodeL;
let suspects = ["Colonel Mustard", "Mrs. Peacock", "Professor Plum", "Mrs. White", "Miss Scarlet", "Reverend Green"];
let weapons = ["Candlestick", "Dagger", "Lead Pipe", "Revolver", "Rope", "Wrench"];
let rooms = ["Ball Room", "Billiard Room", "Conservatory", "Dining Room", "Hall", "Kitchen", "Library", "Lounge", "Study"];

// Event listener for "Host Game" button to set up a new game room
document.querySelector("#hostGameBtn").addEventListener('click', async () => {
    // Generate unique room code and display the game room UI
    roomCodeL = generateRoomCode();
    document.getElementById("game-room").style.display = "block";
    document.getElementById("main-menu").style.display = "none";

    // Create initial game data in Firestore with placeholders for cards and players
    await setDoc(doc(db, "ongoingGames", roomCodeL), {
        gameStarted: false,
        roomCode: roomCodeL,
        hiddenCards: [null, null, null],
        playerCards: [null, null, null, null, null, null],  // Placeholder for player cards
        players: [null, null, null, null, null, null]        // Placeholder for player names
    });

    // Display room code in the UI for players to join
    document.getElementById("roomCodeDisplay").innerHTML = roomCodeL;

    // Reference to the game document in Firestore
    const gameRef = doc(db, "ongoingGames", roomCodeL);

    // Set up real-time listener to update player names list in the UI as players join
    const unsubscribe = onSnapshot(gameRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            const players = data.players;

            // Clear and update the player names list
            const playerListElement = document.getElementById("playerNamesList");
            playerListElement.innerHTML = ""; // Clear previous entries

            players.forEach((player, index) => {
                const listItem = document.createElement("li");
                listItem.textContent = player ? player : `Waiting for player ${index + 1}...`;
                playerListElement.appendChild(listItem);
            });
        }
    });

    // Event listener for "Start Game" button to finalize game setup
    document.querySelector("#startGameBtn").addEventListener('click', () => {
        getDoc(gameRef).then((docSnap) => {
            let playerArray = docSnap.data()['players'];
            const nullCount = playerArray.filter(item => item === null).length;
            const playerCount = 6 - nullCount;

            // Ensure there are enough players to start the game
            if (playerCount < 2) {
                alert("Insufficient number of players");
                return;
            }

            // Stop the real-time listener after starting the game
            unsubscribe();
            console.log("Snapshot listener stopped.");

            // Select random hidden cards for the game
            const suspectIndex = Math.floor(Math.random() * suspects.length);
            const weaponIndex = Math.floor(Math.random() * weapons.length);
            const roomIndex = Math.floor(Math.random() * rooms.length);

            // Set the hidden cards and remove selected items from the game pool
            const hiddenCardsL = [suspects[suspectIndex], weapons[weaponIndex], rooms[roomIndex]];
            suspects.splice(suspectIndex, 1);
            weapons.splice(weaponIndex, 1);
            rooms.splice(roomIndex, 1);

            // Combine remaining cards and shuffle them for distribution
            const totalCards = [...suspects, ...weapons, ...rooms];

            // Function to shuffle an array (Fisher-Yates algorithm)
            function shuffle(array) {
                for (let i = array.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [array[i], array[j]] = [array[j], array[i]];
                }
            }

            // Shuffle the deck of total cards
            shuffle(totalCards);

            // Distribute shuffled cards evenly among players
            const playerCards = Array.from({ length: playerCount }, () => []);
            for (let i = 0; i < totalCards.length; i++) {
                const playerIndex = i % playerCount; // Cycle through player indices
                playerCards[playerIndex].push(totalCards[i]); // Assign card to respective player
            }

            // Convert each player's cards to a string format and add nulls for unused slots
            const resultCards = playerCards.map((cards) => cards.length > 0 ? cards.join(':') : null);
            const finalPlayerCards = [...resultCards, ...Array(6 - playerCount).fill(null)];

            // Log final card assignments and hidden cards
            console.log(finalPlayerCards);
            console.log(hiddenCardsL);

            // Update Firestore document to start the game and assign cards
            setDoc(gameRef, {
                gameStarted: true,
                hiddenCards: hiddenCardsL,
                playerCards: finalPlayerCards
            }, { merge: true }).then(() => {
                // Show host room UI and update player list after starting the game
                document.getElementById("game-room").style.display = 'none';
                document.getElementById("host-room").style.display = 'block';
                playerArray = playerArray.filter(item => item !== null);

                const playerListElement = document.getElementById("playerNamesListHost");
                playerListElement.innerHTML = ""; // Clear previous entries

                playerArray.forEach((player) => {
                    const listItem = document.createElement("li");
                    listItem.textContent = player;
                    playerListElement.appendChild(listItem);
                });
            });
        });
    });
});

// Event listener for "End Game" button to delete game data from Firestore
document.querySelector("#endGameBtn").addEventListener('click', () => {
    deleteDoc(doc(db, "ongoingGames", roomCodeL)).then(() => {
        // Reset UI to the main menu after game ends
        document.getElementById("main-menu").style.display = "block";
        document.getElementById("host-room").style.display = "none";
        document.getElementById("game-room").style.display = "none";
        document.getElementById("player-menu").style.display = "none";
    });
});

// Event listener for "Reveal Cards" button to show player cards and hidden cards
document.querySelector("#revealCardsBtn").addEventListener('click', () => {
    getDoc(doc(db, "ongoingGames", roomCodeL)).then((docSnap) => {
        const playerNames = docSnap.data()["players"].filter(item => item !== null);
        let playerCards = docSnap.data().playerCards;

        // Update UI to display each player's assigned cards
        const playerListElement = document.getElementById("playerNamesListHost");
        playerListElement.innerHTML = ""; // Clear previous entries

        playerNames.forEach((player, index) => {
            const listItem = document.createElement("li");
            if (playerCards[index]) {
                // Display cards for each player
                const cardsArray = playerCards[index].split(':').map(card => card.trim()).join(', ');
                listItem.textContent = `${player} : ${cardsArray}`;
            } else {
                listItem.textContent = `${player} : No cards available`;
            }
            playerListElement.appendChild(listItem);
        });

        // Display hidden cards used to determine the 'murder' scenario
        document.getElementById("hiddenCards").innerHTML = `${docSnap.data()["hiddenCards"][0]} murdered with ${docSnap.data()["hiddenCards"][1]} in ${docSnap.data()["hiddenCards"][2]}`;
        document.getElementById("titleHostName").innerHTML = "The game has ended";

        // Delete game data after revealing cards
        deleteDoc(doc(db, "ongoingGames", roomCodeL));
    }).catch((error) => {
        console.error("Error fetching game data:", error); // Log error
        alert("Room does not exist!!!");
    });
});

// Event listeners for Join Game
document.querySelector("#joinGameBtn").addEventListener('click', () => {
    document.getElementById("player-menu").style.display = "block";
    document.getElementById("main-menu").style.display = "none";
    document.getElementById("joinGameRoomH3").innerHTML = "Join an Existing Game Room";
    document.getElementById("joinRoomForm").style.display = "block";
});

// Add event listener to the form submission
document.querySelector("#joinRoomBtn").addEventListener('click', async () => {
    // Get the room code entered by the user and trim any whitespace
    const roomCodeL = document.getElementById("roomCodeInput").value.trim();
    const userName = document.getElementById("usernameInput").value.trim();

    // Create a reference to the document in the "ongoingGames" collection with the specified room code
    const docRef = doc(db, "ongoingGames", roomCodeL);

    try {
        // Fetch the document from Firestore
        const docSnap = await getDoc(docRef);

        // Check if the document exists in the database
        if (!docSnap.exists()) {
            alert("Invalid Room ID");
            return; // Exit the function if the document doesn't exist
        }

        // Check if cookies for roomCode, username are already set (user session info)
        if (getCookie("roomCode") && getCookie("username")) {
            // Verify if the roomCode stored in the cookie matches the entered room code
            if (getCookie("roomCode") == roomCodeL) {

                // Retrieve the players array from the document data
                const playersArr = docSnap.data().players;

                // Initialize a flag to check if the user already exists in the players array
                let userExists = false;

                // Loop through the players array to check if the stored username is in it
                playersArr.forEach(player => {
                    if (player == getCookie("username")) {
                        userExists = true; // Set flag to true if username is found
                        return;
                    }
                });

                // If the user exists in the players array and the game has started
                if (userExists && docSnap.data().gameStarted) {
                    showCards(roomCodeL, userName);

                } else if (userExists && !docSnap.data().gameStarted) {
                    document.getElementById("joinGameRoomH3").innerHTML = `You have joined room with code ${roomCodeL}. Please wait for the host to begin the game`;
                    document.getElementById("joinRoomForm").style.display = "none";
                }
            }
        }

        let players = docSnap.data().players;
        // Find the index of the first null value in the array
        const nullIndex = players.findIndex(player => player === null);

        if (nullIndex !== -1) {
            // Replace the first null value with "be"
            players[nullIndex] = userName;

            // Update the players array in Firestore
            setDoc(docRef, {
                players: players
            }, { merge: true }).then(() => {
                setCookie("username", userName);
                setCookie("roomCode", roomCodeL);
                document.getElementById("joinGameRoomH3").innerHTML = `You have joined room with code ${roomCodeL}. Please wait for the host to begin the game`;
                document.getElementById("joinRoomForm").style.display = "none";

                const unsubscribe = onSnapshot(docRef, (docSnap) => {
                    if (docSnap.exists()) {
                        // Get the gameStarted field
                        const gameStarted = docSnap.data().gameStarted;

                        // Check if gameStarted is true
                        if (gameStarted) {
                            // Stop listening to further changes
                            unsubscribe();

                            showCards(roomCodeL, userName);
                        }
                    } else {
                        console.log("Document does not exist!");
                    }
                })
            })
        } else {
            alert("No empty slot found in the players array.");
        }
    } catch (error) {
        // Log any errors encountered during the document retrieval
        console.error("Error checking document:", error);
    }
});

// Utility function to generate a random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Utility function to set cookies for 2 hours
function setCookie(name, value) {
    const date = new Date();
    date.setTime(date.getTime() + (2 * 60 * 60 * 1000));
    document.cookie = `${name}=${value}; expires=${date.toUTCString()}; path=/`;
}

// Utility function to get cookies
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
}

// Function to add a new card row to the table body
function addCardRow(cardName) {
    // Get the table body by its ID
    const cardTableBody = document.getElementById("cardTableBody");

    // Create a new table row
    const newRow = document.createElement("tr");

    // Create the first cell with the card name
    const cardCell = document.createElement("td");
    cardCell.textContent = cardName; // Set the card name as the text content of the cell

    // Create the second cell with the button
    const actionCell = document.createElement("td");
    const button = document.createElement("button");
    button.className = "btn toggleCard"; // Set the class for the button
    button.innerHTML = '<i class="bi bi-eye-fill"></i>'; // Add the icon to the button

    // Append the button to the action cell
    actionCell.appendChild(button);

    // Append the cells to the new row
    newRow.appendChild(cardCell);
    newRow.appendChild(actionCell);

    // Append the new row to the table body
    cardTableBody.appendChild(newRow);
}


function showCards(roomCode, username) {
    document.getElementById("cardTableSection").style.display = "block";
    document.getElementById("player-menu").style.display = "none";
    document.getElementById("cardSectionH3").innerHTML = `Hello, ${username}. Here are your cards. Play fairly. May the best detective win!!`;

    getDoc(doc(db, "ongoingGames", roomCode)).then((docSnap) => {
        const userIndex = docSnap.data().players.indexOf(username);
        const userCards = docSnap.data().playerCards[userIndex].split(":");

        userCards.forEach((card) => {
            addCardRow(card);
        })


        // JavaScript to toggle visibility of individual cards and icons
        const tableRows = document.querySelectorAll("#cardTable tr");

        // Loop through each row and add click event listeners to the buttons
        tableRows.forEach(row => {
            const button = row.querySelector("td:last-child .toggleCard"); // Select the button in the second column

            // Ensure the button exists before adding the event listener
            if (button) {
                button.addEventListener("dblclick", () => {
                    const cardCell = row.querySelector("td:first-child"); // Get the first cell in the row
                    const iconElement = button.querySelector("i"); // Get the icon inside the button

                    // Toggle the hidden class on the first cell
                    cardCell.classList.toggle("hidden");

                    // Change the icon class based on the visibility of the cardCell
                    if (cardCell.classList.contains("hidden")) {
                        iconElement.classList.remove("bi-eye-fill"); // Remove the eye icon
                        iconElement.classList.add("bi-eye-slash-fill"); // Add the eye-slash icon
                    } else {
                        iconElement.classList.remove("bi-eye-slash-fill"); // Remove the eye-slash icon
                        iconElement.classList.add("bi-eye-fill"); // Add the eye icon
                    }
                });
            }
        });
    })
}

// JavaScript to toggle visibility of cards and icons
const toggleAllBtn = document.getElementById("toggleAllBtn");

// Toggle all cards visibility
toggleAllBtn.addEventListener("dblclick", () => {
    // Use the correct selector to get all rows in the card table
    const tableRows = document.querySelectorAll("#cardTable tr");

    // Determine the current state based on the inner HTML of the toggle button
    const isHiding = toggleAllBtn.innerHTML.includes("Hide All");

    // Loop through each row and toggle the visibility of the first cell
    tableRows.forEach(row => {
        // Select the first cell in the current row
        const cardCell = row.querySelector("td:first-child");
        const iconElement = row.querySelector("td:last-child i");

        // Ensure that the first cell exists before trying to access its classList
        if (cardCell && iconElement) {
            // If we are hiding, add the hidden class
            if (isHiding) {
                cardCell.classList.add("hidden");
                iconElement.classList.remove("bi-eye-fill");  // Remove the eye icon
                iconElement.classList.add("bi-eye-slash-fill"); // Add the eye-slash icon
            } else {
                cardCell.classList.remove("hidden");
                iconElement.classList.remove("bi-eye-slash-fill"); // Remove the eye-slash icon
                iconElement.classList.add("bi-eye-fill"); // Add the eye icon
            }
        }
    });

    // Update the button text based on the action taken
    if (isHiding) {
        toggleAllBtn.innerHTML = 'Show All <i class="bi bi-eye-slash-fill"></i>';
    } else {
        toggleAllBtn.innerHTML = 'Hide All <i class="bi bi-eye-fill"></i>';
    }
});

// JavaScript to toggle visibility of individual cards and icons
const tableRows = document.querySelectorAll("#cardTable tr");

// Loop through each row and add click event listeners to the buttons
tableRows.forEach(row => {
    const button = row.querySelector("td:last-child .toggleCard"); // Select the button in the second column

    // Ensure the button exists before adding the event listener
    if (button) {
        button.addEventListener("dblclick", () => {
            const cardCell = row.querySelector("td:first-child"); // Get the first cell in the row
            const iconElement = button.querySelector("i"); // Get the icon inside the button

            // Toggle the hidden class on the first cell
            cardCell.classList.toggle("hidden");

            // Change the icon class based on the visibility of the cardCell
            if (cardCell.classList.contains("hidden")) {
                iconElement.classList.remove("bi-eye-fill"); // Remove the eye icon
                iconElement.classList.add("bi-eye-slash-fill"); // Add the eye-slash icon
            } else {
                iconElement.classList.remove("bi-eye-slash-fill"); // Remove the eye-slash icon
                iconElement.classList.add("bi-eye-fill"); // Add the eye icon
            }
        });
    }
});