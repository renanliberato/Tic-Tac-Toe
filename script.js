const connection = new signalR.HubConnectionBuilder()
    .withUrl("https://localhost:5001/gamehub")
    .configureLogging(signalR.LogLevel.Information)
    .build();

let ID = function () {
    // Math.random should be unique because of its seeding algorithm.
    // Convert it to base 36 (numbers + letters), and grab the first 9 characters
    // after the decimal.
    return '_' + Math.random().toString(36).substr(2, 9);
};

const matchId = (new URLSearchParams(location.search)).get('match');
const isMain = (new URLSearchParams(location.search)).get('ismain') ? true : false;

if (!matchId) {
    location.href = `/?match=${ID()}&ismain=1`;
}

const statusDisplay = document.querySelector('.game--status');

let player = isMain ? "X" : "";
let gameActive = true;
let secondPlayerLoaded = false;
let currentPlayer = "X";
let gameState = ["", "", "", "", "", "", "", "", ""];
let messagesHistory = [];
let stateFromOtherPlayerTimeout;

connection.on("OnSendEventToOtherMatchClients", (message) => {
    if (message.from == connection.connectionId)
        return;

    handleMessage(message);
});

async function handleMessage(message) {
    switch (message.event) {
        case 'messages_request':
            if (isMain) {
                await connection.invoke("SendEventToOtherMatchClients", matchId, {
                    from: connection.connectionId,
                    interested: message.from,
                    event: 'messages_answer',
                    data: {
                        messages: messagesHistory,
                        isFull: secondPlayerLoaded
                    }
                })
            }
            break;
        case 'messages_answer':
            if (message.interested == connection.connectionId) {
                clearInterval(stateFromOtherPlayerTimeout);
                message.data.messages.forEach(handleMessage);

                if (message.data.isFull) {
                    alert('Room is full, entering as a spectator.');
                } else {
                    player = 'O';
                }
                await connection.invoke("SendEventToOtherMatchClients", matchId, {
                    from: connection.connectionId,
                    event: 'got_messages'
                });
            }
            break;
        case 'got_messages':
            if (isMain) {
                secondPlayerLoaded = true;
                statusDisplay.innerHTML = currentPlayerTurn(); 
            }
            break;
        case 'played':
            handleCellClick({ target: document.querySelector(`[data-cell-index="${message.data.cellIndex}"]`) });
            break;
        case 'restart':
            handleRestartGame();
            break;
    }
}

connection.on("OnConnectedToMatch", async (state) => {
    if (!isMain) {
        await connection.invoke("SendEventToOtherMatchClients", matchId, {
            from: connection.connectionId,
            event: 'messages_request'
        });

        stateFromOtherPlayerTimeout = setTimeout(() => {
            alert('Could not contact the other player. Creating a match, instead...');
            location.href = `/?match=${ID()}&ismain=1`;
        }, 2000);
    }
});

async function start() {
    try {
        await connection.start();
        await connection.invoke("ConnectToMatch", matchId);
    } catch (err) {
        console.log(err);
        setTimeout(start, 5000);
    }
};

connection.onclose(start);

const winningMessage = () => `Player ${currentPlayer} has won!`;
const drawMessage = () => `Game ended in a draw!`;
const currentPlayerTurn = () => isMain && !secondPlayerLoaded ? 'Waiting for another player' : currentPlayer == player ? `It's your turn` : `It's ${currentPlayer}'s turn`;

statusDisplay.innerHTML = currentPlayerTurn();

const winningConditions = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

function handleCellPlayed(clickedCell, clickedCellIndex) {
    gameState[clickedCellIndex] = currentPlayer;
    clickedCell.innerHTML = currentPlayer;
}

function handlePlayerChange() {
    currentPlayer = currentPlayer === "X" ? "O" : "X";
    statusDisplay.innerHTML = currentPlayerTurn();
}

function handleResultValidation() {
    let roundWon = false;
    for (let i = 0; i <= 7; i++) {
        const winCondition = winningConditions[i];
        let a = gameState[winCondition[0]];
        let b = gameState[winCondition[1]];
        let c = gameState[winCondition[2]];
        if (a === '' || b === '' || c === '') {
            continue;
        }
        if (a === b && b === c) {
            roundWon = true;
            break
        }
    }

    if (roundWon) {
        statusDisplay.innerHTML = winningMessage();
        gameActive = false;
        return;
    }

    let roundDraw = !gameState.includes("");
    if (roundDraw) {
        statusDisplay.innerHTML = drawMessage();
        gameActive = false;
        return;
    }

    handlePlayerChange();
}

async function handleCellClick(clickedCellEvent) {
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));

    if (gameState[clickedCellIndex] !== "" || !gameActive) {
        return;
    }

    handleCellPlayed(clickedCell, clickedCellIndex);
    handleResultValidation();
}

async function handleCellClickNotifyingServer(clickedCellEvent) {
    const clickedCell = clickedCellEvent.target;
    const clickedCellIndex = parseInt(clickedCell.getAttribute('data-cell-index'));

    if ((isMain && !secondPlayerLoaded) || player != currentPlayer)
        return;

    const eventToMultiplayer = {
        event: 'played',
        from: connection.connectionId,
        data: { cellIndex: clickedCellIndex }
    };

    messagesHistory.push(eventToMultiplayer);

    await connection.invoke("SendEventToOtherMatchClients", matchId, eventToMultiplayer)

    handleCellClick(clickedCellEvent)
}

async function handleRestartGameNotifyingServer() {
    const eventToMultiplayer = {
        event: 'restart',
        from: connection.connectionId,
    };

    messagesHistory = [];

    await connection.invoke("SendEventToOtherMatchClients", matchId, eventToMultiplayer);

    handleRestartGame();
}

function handleRestartGame() {
    gameActive = true;
    currentPlayer = "X";
    gameState = ["", "", "", "", "", "", "", "", ""];
    statusDisplay.innerHTML = currentPlayerTurn();
    document.querySelectorAll('.cell').forEach(cell => cell.innerHTML = "");
}

document.querySelectorAll('.cell').forEach(cell => cell.addEventListener('click', handleCellClickNotifyingServer));
if (isMain)
    document.querySelector('.game--restart').addEventListener('click', handleRestartGameNotifyingServer);
else
    document.querySelector('.game--restart').style.display = 'none';

// Start the connection.
start();
