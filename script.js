document.addEventListener('DOMContentLoaded', () => {
    const boardElement = document.getElementById('board');
    const inputs = [];
    const consoleDiv = document.getElementById('console-log');
    
    // UI 元素
    const elFilled = document.getElementById('stat-filled');
    const elMissing = document.getElementById('stat-missing');
    const elStatus = document.getElementById('status-indicator');
    
    // 按鈕
    const btnSolve = document.getElementById('btn-solve');
    const btnClear = document.getElementById('btn-clear');
    const btnOpenImport = document.getElementById('btn-open-import');
    const btnCheckSum = document.getElementById('btn-check-sum');
    
    // Modal 元素
    const modal = document.getElementById('import-modal');
    const txtImport = document.getElementById('import-text');
    const btnConfirmImport = document.getElementById('btn-confirm-import');
    const btnCloseModal = document.getElementById('btn-close-modal');

    // --- 1. 初始化 ---
    function initBoard() {
        for (let i = 0; i < 81; i++) {
            const input = document.createElement('input');
            input.type = 'text';
            input.maxLength = 1;
            input.dataset.index = i;
            
            const row = Math.floor(i / 9);
            const col = i % 9;

            if (col === 2 || col === 5) input.classList.add('thick-right');
            if (row === 2 || row === 5) input.classList.add('thick-bottom');
            if (col === 8) input.classList.add('no-right-border');
            if (row === 8) input.classList.add('no-bottom-border');

            input.addEventListener('input', (e) => {
                const val = e.target.value;
                if (!/^[1-9]$/.test(val)) e.target.value = '';
                updateGameState();
            });
            input.addEventListener('focus', (e) => e.target.select());
            input.addEventListener('keydown', handleNavigation);

            inputs.push(input);
            boardElement.appendChild(input);
        }
        
        // 綁定所有按鈕事件
        btnSolve.addEventListener('click', runSolver);
        btnClear.addEventListener('click', clearBoard);
        
        // 新增功能的事件綁定
        btnOpenImport.addEventListener('click', () => modal.classList.remove('hidden'));
        btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
        btnConfirmImport.addEventListener('click', parseInputData);
        btnCheckSum.addEventListener('click', checkSumAndVerify);

        log("System Ready. v2.0 Loaded.");
    }

    // --- 2. Import 功能 (使用 Split 邏輯) ---
    function parseInputData() {
        const rawText = txtImport.value;
        if (!rawText) return;

        // 1. 利用 split('\n') 將文字切成一行一行
        let lines = rawText.split('\n');
        
        // 過濾掉空白行，修剪前後空白
        lines = lines.map(line => line.trim()).filter(line => line.length > 0);

        let mergedString = "";

        // 2. 處理每一行資料
        lines.forEach(line => {
            // 如果一行裡面是用逗號或空格分開 (如: 1,2,3...)，也可以用 split 切割
            // 這裡我們簡化邏輯：只取出該行所有的數字
            const digits = line.replace(/[^0-9]/g, ''); 
            mergedString += digits;
        });

        // 3. 填入盤面
        if (mergedString.length < 81) {
            log(`Import Warning: Only found ${mergedString.length} digits (Need 81).`, 'warn');
        }

        clearBoard(false); // 清空但不印 log
        
        for (let i = 0; i < 81; i++) {
            if (i < mergedString.length) {
                const char = mergedString[i];
                // 如果是 '0' 或 '.' 當作空格，其他數字填入
                if (char !== '0' && char !== '.') {
                    inputs[i].value = char;
                    inputs[i].classList.add('solved-cell'); // 標記為匯入資料
                }
            }
        }

        modal.classList.add('hidden');
        txtImport.value = ''; // 清空輸入框
        log("Data imported via multi-line split parsing.");
        updateGameState();
    }

    // --- 3. Check Sum 功能 (總和驗證) ---
    function checkSumAndVerify() {
        log("--- Initiating Sum Verification ---");
        let allCorrect = true;
        const board = getCurrentBoard();

        // 檢查每一列 (Row)
        for (let r = 0; r < 9; r++) {
            let sum = 0;
            for (let c = 0; c < 9; c++) {
                sum += board[r][c];
            }
            if (sum !== 45) {
                log(`Row ${r + 1} Sum: ${sum} (Expected 45)`, 'warn');
                allCorrect = false;
            }
        }

        // 檢查每一行 (Column)
        for (let c = 0; c < 9; c++) {
            let sum = 0;
            for (let r = 0; r < 9; r++) {
                sum += board[r][c];
            }
            if (sum !== 45) {
                log(`Col ${c + 1} Sum: ${sum} (Expected 45)`, 'warn');
                allCorrect = false;
            }
        }

        if (allCorrect) {
            log("VERIFICATION PASSED: All rows/cols sum to 45.", 'info');
            elStatus.innerText = "INTEGRITY CHECK PASSED";
            elStatus.className = 'status-success';
        } else {
            log("VERIFICATION FAILED: Check console for details.", 'error');
            elStatus.innerText = "INTEGRITY ERROR";
            elStatus.className = 'status-error';
        }
    }

    // --- 基礎邏輯 (沿用之前的) ---
    function handleNavigation(e) {
        const currentIndex = parseInt(e.target.dataset.index);
        let targetIndex = null;
        const row = Math.floor(currentIndex / 9);
        const col = currentIndex % 9;

        switch(e.key) {
            case 'ArrowUp': if (row > 0) targetIndex = currentIndex - 9; break;
            case 'ArrowDown': if (row < 8) targetIndex = currentIndex + 9; break;
            case 'ArrowLeft': if (col > 0) targetIndex = currentIndex - 1; break;
            case 'ArrowRight': if (col < 8) targetIndex = currentIndex + 1; break;
        }

        if (targetIndex !== null) {
            e.preventDefault();
            inputs[targetIndex].focus();
        }
    }

    function log(msg, type = 'info') {
        const div = document.createElement('div');
        div.className = 'log-entry';
        const time = new Date().toLocaleTimeString('en-GB', { hour12: false });
        const colorClass = type === 'error' ? 'log-err' : (type === 'warn' ? 'log-warn' : '');
        div.innerHTML = `<span class="log-time">[${time}]</span> <span class="${colorClass}">${msg}</span>`;
        consoleDiv.appendChild(div);
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
    }

    function updateGameState() {
        let count = 0;
        inputs.forEach(inp => { if (inp.value !== '') count++; });
        elFilled.innerText = `${count} / 81`;
        elMissing.innerText = `${81 - count}`;

        const conflicts = checkConflicts();
        elStatus.className = ''; 
        
        if (conflicts) {
            elStatus.innerText = "CONFLICT DETECTED";
            elStatus.classList.add('status-error');
        } else if (count === 81) {
            elStatus.innerText = "PUZZLE FILLED"; // 填滿不代表正確，需檢查
            elStatus.classList.add('status-valid');
        } else {
             elStatus.innerText = "WAITING FOR INPUT...";
             elStatus.classList.add('status-waiting');
        }
    }

    function checkConflicts() {
        let hasConflict = false;
        inputs.forEach(inp => inp.classList.remove('error-cell'));
        const board = getCurrentBoard();

        for (let i = 0; i < 81; i++) {
            const val = board[Math.floor(i/9)][i%9];
            if (val === 0) continue;
            const r = Math.floor(i / 9);
            const c = i % 9;
            if (!isValidPlacement(board, r, c, val)) {
                inputs[i].classList.add('error-cell');
                hasConflict = true;
            }
        }
        return hasConflict;
    }

    function isValidPlacement(board, row, col, num) {
        for (let x = 0; x < 9; x++) {
            if (x !== col && board[row][x] === num) return false;
            if (x !== row && board[x][col] === num) return false;
        }
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                const curRow = startRow + i;
                const curCol = startCol + j;
                if ((curRow !== row || curCol !== col) && board[curRow][curCol] === num) return false;
            }
        }
        return true;
    }

    function runSolver() {
        if (checkConflicts()) { log("Aborted: Fix conflicts.", 'error'); return; }
        log("Solver running...", 'info');
        const board = getCurrentBoard();
        setTimeout(() => {
            const start = performance.now();
            if (solveHelper(board)) {
                updateBoardUI(board);
                log(`Solved in ${(performance.now() - start).toFixed(2)}ms.`, 'info');
                updateGameState();
            } else {
                log("Unsolvable puzzle.", 'error');
                elStatus.innerText = "UNSOLVABLE";
                elStatus.classList.add('status-error');
            }
        }, 50);
    }

    function solveHelper(board) {
        for (let row = 0; row < 9; row++) {
            for (let col = 0; col < 9; col++) {
                if (board[row][col] === 0) {
                    for (let num = 1; num <= 9; num++) {
                        if (isSafe(board, row, col, num)) {
                            board[row][col] = num;
                            if (solveHelper(board)) return true;
                            board[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    function isSafe(board, row, col, num) {
        for (let x = 0; x < 9; x++) {
            if (board[row][x] === num || board[x][col] === num) return false;
        }
        const startRow = Math.floor(row / 3) * 3;
        const startCol = Math.floor(col / 3) * 3;
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 3; j++) {
                if (board[startRow + i][startCol + j] === num) return false;
            }
        }
        return true;
    }

    function getCurrentBoard() {
        const board = [];
        for (let i = 0; i < 9; i++) {
            const row = [];
            for (let j = 0; j < 9; j++) {
                const val = inputs[i * 9 + j].value;
                row.push(val === '' ? 0 : parseInt(val));
            }
            board.push(row);
        }
        return board;
    }

    function updateBoardUI(solvedBoard) {
        for (let i = 0; i < 81; i++) {
            const r = Math.floor(i / 9);
            const c = i % 9;
            const oldVal = inputs[i].value;
            const newVal = solvedBoard[r][c];
            if (oldVal === '' && newVal !== 0) {
                inputs[i].value = newVal;
                inputs[i].classList.add('solved-cell');
            }
        }
    }

    function clearBoard(logAction = true) {
        inputs.forEach(inp => {
            inp.value = '';
            inp.classList.remove('solved-cell', 'error-cell');
        });
        if(logAction) log("Board cleared.");
        updateGameState();
    }

    initBoard();
});