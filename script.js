document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 全域變數與 DOM 元素選取
    // ==========================================
    const boardElement = document.getElementById('board');
    const inputs = [];
    const consoleDiv = document.getElementById('console-log');
    
    // UI 狀態顯示
    const elFilled = document.getElementById('stat-filled');
    const elMissing = document.getElementById('stat-missing');
    const elStatus = document.getElementById('status-indicator');
    
    // OCR 相關元素
    const btnImageUpload = document.getElementById('btn-image-upload');
    const hiddenFileInput = document.getElementById('hidden-file-input');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    // 一般按鈕
    const btnSolve = document.getElementById('btn-solve');
    const btnClear = document.getElementById('btn-clear');
    const btnCheckSum = document.getElementById('btn-check-sum');

    // 匯入視窗相關
    const btnOpenImport = document.getElementById('btn-open-import');
    const modal = document.getElementById('import-modal');
    const txtImport = document.getElementById('import-text');
    const btnConfirmImport = document.getElementById('btn-confirm-import');
    const btnCloseModal = document.getElementById('btn-close-modal');

    // ==========================================
    // 2. 初始化系統
    // ==========================================
    function initBoard() {
        // 生成 81 個格子
        for (let i = 0; i < 81; i++) {
            const input = document.createElement('input');
            input.type = 'text'; 
            input.maxLength = 1;
            // 關鍵修改：強制手機跳出數字鍵盤
            input.inputMode = 'numeric'; 
            input.dataset.index = i;
            
            const row = Math.floor(i / 9);
            const col = i % 9;

            // 樣式：加上粗框線
            if (col === 2 || col === 5) input.classList.add('thick-right');
            if (row === 2 || row === 5) input.classList.add('thick-bottom');
            if (col === 8) input.classList.add('no-right-border');
            if (row === 8) input.classList.add('no-bottom-border');

            // 事件：輸入監聽 (手打標記為 manual)
            input.addEventListener('input', (e) => {
                const val = e.target.value;
                // 驗證是否為 1-9
                if (!/^[1-9]$/.test(val)) {
                    e.target.value = '';
                } else {
                    // 如果是用手打的，標記為 Manual 顏色
                    updateCellSource(i, 'manual');
                }
                updateGameState();
            });

            input.addEventListener('focus', (e) => e.target.select());
            input.addEventListener('keydown', handleNavigation);

            inputs.push(input);
            boardElement.appendChild(input);
        }
        
        // 綁定按鈕事件
        btnSolve.addEventListener('click', runSolver);
        btnClear.addEventListener('click', clearBoard);
        btnCheckSum.addEventListener('click', checkSumAndVerify);
        
        // 綁定匯入視窗事件
        btnOpenImport.addEventListener('click', () => modal.classList.remove('hidden'));
        btnCloseModal.addEventListener('click', () => modal.classList.add('hidden'));
        btnConfirmImport.addEventListener('click', parseInputData);

        // 綁定 OCR 上傳事件
        btnImageUpload.addEventListener('click', () => hiddenFileInput.click());
        hiddenFileInput.addEventListener('change', handleImageUpload);

        log("System Ready. Mobile Input Optimized.");
    }

    // --- 核心工具：更新格子來源顏色 ---
    function updateCellSource(index, type) {
        const inp = inputs[index];
        // 先移除所有來源標籤
        inp.classList.remove('source-manual', 'source-import', 'source-ocr', 'solved-cell');
        
        // 根據類型加上對應 Class
        if (type === 'manual') inp.classList.add('source-manual');
        if (type === 'import') inp.classList.add('source-import');
        if (type === 'ocr') inp.classList.add('source-ocr');
        if (type === 'solved') inp.classList.add('solved-cell');
    }

    // ==========================================
    // 3. OCR 影像辨識核心 (標記為 OCR)
    // ==========================================
    async function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;

        loadingOverlay.classList.remove('hidden');
        loadingText.innerText = "LOADING IMAGE...";

        try {
            const imgBitmap = await createImageBitmap(file);
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = imgBitmap.width;
            canvas.height = imgBitmap.height;
            ctx.drawImage(imgBitmap, 0, 0);

            loadingText.innerText = "INITIALIZING AI...";
            const worker = await Tesseract.createWorker('eng');
            await worker.setParameters({
                tessedit_char_whitelist: '123456789',
                tessedit_pageseg_mode: Tesseract.PSM.SINGLE_CHAR, 
            });

            loadingText.innerText = "ANALYZING GRID...";
            clearBoard(false); 

            const cellW = canvas.width / 9;
            const cellH = canvas.height / 9;
            let filledCount = 0;

            for (let row = 0; row < 9; row++) {
                for (let col = 0; col < 9; col++) {
                    const index = row * 9 + col;
                    // 進度顯示優化：每 9 格更新一次文字，避免閃爍太快
                    if (col === 0) loadingText.innerText = `SCANNING ROW ${row + 1}/9...`;

                    const paddingX = cellW * 0.15;
                    const paddingY = cellH * 0.15;
                    const cutX = col * cellW + paddingX;
                    const cutY = row * cellH + paddingY;
                    const cutW = cellW - (paddingX * 2);
                    const cutH = cellH - (paddingY * 2);

                    const cellImageData = ctx.getImageData(cutX, cutY, cutW, cutH);

                    if (isEmptyCell(cellImageData)) continue;

                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = cutW;
                    tempCanvas.height = cutH;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.putImageData(cellImageData, 0, 0);
                    preprocessCanvas(tempCanvas);

                    const { data: { text, confidence } } = await worker.recognize(tempCanvas);
                    const digit = text.replace(/[^1-9]/g, '');

                    if (digit && confidence > 50) {
                        inputs[index].value = digit;
                        // 標記為 OCR 來源 (紫色)
                        updateCellSource(index, 'ocr');
                        filledCount++;
                    }
                }
            }

            await worker.terminate();
            log(`OCR Complete. Found ${filledCount} digits.`, 'info');
            updateGameState();
            
        } catch (err) {
            log("OCR Error: " + err.message, 'error');
            alert("辨識發生錯誤，請重試。");
        } finally {
            loadingOverlay.classList.add('hidden');
            hiddenFileInput.value = '';
        }
    }

    // 輔助：檢查是否為空白格
    function isEmptyCell(imageData) {
        const data = imageData.data;
        let darkPixels = 0;
        const threshold = 200; 
        for (let i = 0; i < data.length; i += 4) {
            if ((data[i] + data[i+1] + data[i+2]) / 3 < threshold) darkPixels++;
        }
        return (darkPixels / (data.length / 4)) < 0.02;
    }

    function preprocessCanvas(canvas) {
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i+=4) {
            const v = (d[i] + d[i+1] + d[i+2] >= 400) ? 255 : 0;
            d[i] = d[i+1] = d[i+2] = v;
        }
        ctx.putImageData(imgData, 0, 0);
    }

    // ==========================================
    // 4. UI 功能邏輯 (文字匯入、總和檢查、導航)
    // ==========================================
    
    // 文字匯入功能 (標記為 Import)
    function parseInputData() {
        const rawText = txtImport.value;
        if (!rawText) return;

        let lines = rawText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
        let mergedString = "";
        lines.forEach(line => {
            mergedString += line.replace(/[^0-9]/g, '');
        });

        clearBoard(false);
        
        for (let i = 0; i < 81; i++) {
            if (i < mergedString.length) {
                const char = mergedString[i];
                if (char !== '0' && char !== '.') {
                    inputs[i].value = char;
                    // 標記為 Import 來源 (黃色)
                    updateCellSource(i, 'import');
                }
            }
        }
        modal.classList.add('hidden');
        txtImport.value = '';
        log("Text Data Imported.");
        updateGameState();
    }

    function checkSumAndVerify() {
        log("--- Checking Sums ---");
        let allCorrect = true;
        const board = getCurrentBoard();

        for (let i = 0; i < 9; i++) {
            let rowSum = 0, colSum = 0;
            for (let j = 0; j < 9; j++) {
                rowSum += board[i][j];
                colSum += board[j][i];
            }
            if (rowSum !== 45) { log(`Row ${i+1} Sum: ${rowSum} (Error)`, 'warn'); allCorrect = false; }
            if (colSum !== 45) { log(`Col ${i+1} Sum: ${colSum} (Error)`, 'warn'); allCorrect = false; }
        }

        if (allCorrect) {
            log("VERIFICATION PASSED: Sums are 45.", 'info');
            elStatus.innerText = "INTEGRITY CHECK PASSED";
            elStatus.className = 'status-success';
        } else {
            log("VERIFICATION FAILED.", 'error');
            elStatus.innerText = "INTEGRITY ERROR";
            elStatus.className = 'status-error';
        }
    }

    function handleNavigation(e) {
        const idx = parseInt(e.target.dataset.index);
        let target = null;
        const r = Math.floor(idx / 9), c = idx % 9;

        switch(e.key) {
            case 'ArrowUp': if (r > 0) target = idx - 9; break;
            case 'ArrowDown': if (r < 8) target = idx + 9; break;
            case 'ArrowLeft': if (c > 0) target = idx - 1; break;
            case 'ArrowRight': if (c < 8) target = idx + 1; break;
        }
        if (target !== null) { e.preventDefault(); inputs[target].focus(); }
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
            elStatus.innerText = "PUZZLE FILLED";
            elStatus.classList.add('status-valid');
        } else {
             elStatus.innerText = "WAITING FOR INPUT...";
             elStatus.classList.add('status-waiting');
        }
    }

    // ==========================================
    // 5. 數獨解題演算法 (Backtracking)
    // ==========================================
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

    // 更新盤面 (標記為 Solved 來源)
    function updateBoardUI(solvedBoard) {
        for (let i = 0; i < 81; i++) {
            const r = Math.floor(i / 9);
            const c = i % 9;
            const oldVal = inputs[i].value;
            const newVal = solvedBoard[r][c];
            if (oldVal === '' && newVal !== 0) {
                inputs[i].value = newVal;
                // 標記為電腦算出來的 (綠色)
                updateCellSource(i, 'solved');
            }
        }
    }

    function clearBoard(logAction = true) {
        inputs.forEach(inp => {
            inp.value = '';
            // 移除所有顏色標籤
            inp.classList.remove('source-manual', 'source-import', 'source-ocr', 'solved-cell', 'error-cell');
        });
        if(logAction) log("Board cleared.");
        updateGameState();
    }

    initBoard();
});