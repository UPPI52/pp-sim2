/* 
 * GTR優先AI改修版 - 色認識システム統合版
 * - ネクストリセット時に色認識をやり直す
 * - 優先度順: 1手目main → 1手目sub → 2手目main → 2手目sub
 * - 色をA,B,C,Dのアルファベットにマッピング
 */

const WIDTH = 6;
const HEIGHT = 14;
const SEARCH_VISIBLE_HEIGHT = 12;

// ============ 色認識システム ============

/**
 * 色認識の優先度ルール
 * ネクストがリセットされるたびに色認識をやり直す
 */
function recognizeColors(piece1, piece2) {
    if (!piece1 || !piece2) return null;
    
    const colorMap = {};      // 色番号 → アルファベット
    const usedLetters = new Set();
    let nextLetter = 'A';
    
    /**
     * 優先度順に色を処理
     * 優先度: 1手目main → 1手目sub → 2手目main → 2手目sub
     */
    const priorityOrder = [
        piece1.mainColor,
        piece1.subColor,
        piece2.mainColor,
        piece2.subColor
    ];
    
    // ケース (i): 1手目が同じ色か判定
    if (piece1.mainColor === piece1.subColor) {
        // (i) 1手目が同じ色
        const baseColor = piece1.mainColor;
        colorMap[baseColor] = 'A';
        usedLetters.add('A');
        nextLetter = 'B';
        
        // 2手目の色を処理（優先度順）
        for (const color of [piece2.mainColor, piece2.subColor]) {
            if (!(color in colorMap)) {
                colorMap[color] = nextLetter;
                usedLetters.add(nextLetter);
                nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
            }
        }
    } else {
        // (ii) 1手目が異なる色
        
        // a) 1手目と2手目に共通する色があるか
        const piece1Colors = new Set([piece1.mainColor, piece1.subColor]);
        const piece2Colors = new Set([piece2.mainColor, piece2.subColor]);
        const commonColors = [];
        
        for (const c of piece1Colors) {
            if (piece2Colors.has(c)) {
                commonColors.push(c);
            }
        }
        
        if (commonColors.length > 0) {
            // (ii-a) 共通する色がある
            let baseColor;
            if (commonColors.length === 2) {
                // 2色ある場合は1手目のmainをAにする
                baseColor = piece1.mainColor;
            } else {
                // 1色の場合はそれをAにする
                baseColor = commonColors[0];
            }
            
            colorMap[baseColor] = 'A';
            usedLetters.add('A');
            nextLetter = 'B';
            
            // 優先度順に新しい色を処理
            for (const color of priorityOrder) {
                if (!(color in colorMap)) {
                    colorMap[color] = nextLetter;
                    usedLetters.add(nextLetter);
                    nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
                }
            }
        } else {
            // (ii-b) 共通する色がない
            // 認識優先順に新しい色が出る度にアルファベットを振り分け
            for (const color of priorityOrder) {
                if (!(color in colorMap)) {
                    colorMap[color] = nextLetter;
                    usedLetters.add(nextLetter);
                    nextLetter = String.fromCharCode(nextLetter.charCodeAt(0) + 1);
                }
            }
        }
    }
    
    return colorMap;
}

/**
 * ピースの色を数値からアルファベットに変換
 */
function convertPiecesToLetters(piece, colorMap) {
    if (!piece || !colorMap) return null;
    
    return {
        mainColor: colorMap[piece.mainColor],
        subColor: colorMap[piece.subColor]
    };
}

/**
 * 3手分のピースを色認識してアルファベットに変換
 */
function recognizeAndConvertPieces(pieces) {
    if (!pieces || pieces.length < 2) return null;
    
    // 色認識（1,2手目に基づいて）
    const colorMap = recognizeColors(pieces[0], pieces[1]);
    if (!colorMap) return null;
    
    // ピースを変換
    const convertedPieces = [];
    for (let i = 0; i < Math.min(pieces.length, 3); i++) {
        convertedPieces.push(convertPiecesToLetters(pieces[i], colorMap));
    }
    
    return {
        pieces: convertedPieces,
        colorMap: colorMap
    };
}

// ============ 座標変換（1-indexed → 0-indexed） ============

function colToX(col1based) {
    return (col1based | 0) - 1;
}

// ============ ピース配置の基本関数 ============

function piecePattern(p) {
    if (!p) return null;
    const a = p.mainColor;
    const b = p.subColor;
    if (a === b) return `${a}${a}`;
    if (a < b) return `${a}${b}`;
    return `${b}${a}`;
}

function pieceCoords(piece, x, y, rotation) {
    let sx = x, sy = y;
    
    if (rotation === 0) sy = y + 1;           // 縦置き（main下）
    else if (rotation === 1) sx = x - 1;     // 横置き（sub左）
    else if (rotation === 2) sy = y - 1;     // 縦置き（main上）
    else if (rotation === 3) sx = x + 1;     // 横置き（sub右）
    
    return [
        { x, y, color: piece.mainColor },
        { x: sx, y: sy, color: piece.subColor }
    ];
}

function canPlace(board, piece, x, y, rotation) {
    const idx = (x, y) => y * WIDTH + x;
    const get = (board, x, y) => board[idx(x, y)];
    
    const coords = pieceCoords(piece, x, y, rotation);
    
    for (const c of coords) {
        if (c.x < 0 || c.x >= WIDTH || c.y < 0 || c.y >= HEIGHT) return false;
        if (c.y < SEARCH_VISIBLE_HEIGHT && get(board, c.x, c.y) !== 0) return false;
    }
    return true;
}

function findRestY(board, piece, x, rotation) {
    let y = HEIGHT - 2;
    if (!canPlace(board, piece, x, y, rotation)) return null;
    
    while (y > 0 && canPlace(board, piece, x, y - 1, rotation)) {
        y--;
    }
    return y;
}

function findPlacement(board, piece, x, rotation) {
    const y = findRestY(board, piece, x, rotation);
    if (y === null) return null;
    return { x, y, rotation };
}

// ============ 配置パターンヘルパー ============

function placeHorizontal(board, piece, leftCol1based, mainOnLeft = true) {
    const x = colToX(leftCol1based);
    if (x < 0 || x >= WIDTH) return null;
    if (mainOnLeft) {
        return findPlacement(board, piece, x, 3); // main 左
    } else {
        return findPlacement(board, piece, x, 1); // main 右
    }
}

function placeVertical(board, piece, col1based, targetColorAtBottom) {
    const x = colToX(col1based);
    if (x < 0 || x >= WIDTH) return null;
    if (piece.mainColor === targetColorAtBottom) {
        return findPlacement(board, piece, x, 0); // main が下（rotation 0）
    }
    if (piece.subColor === targetColorAtBottom) {
        return findPlacement(board, piece, x, 2); // sub が下（rotation 2）
    }
    return null;
}

// ============ GTR型判定 ============

function detectGTRType(pieces) {
    if (!pieces || pieces.length < 2) return null;
    
    const p1 = pieces[0];
    const p2 = pieces[1];
    const pat1 = piecePattern(p1);
    const pat2 = piecePattern(p2);
    
    const baseColor = p1.mainColor;
    const p1colors = new Set([p1.mainColor, p1.subColor]);
    const p2colors = new Set([p2.mainColor, p2.subColor]);
    const allColors = new Set([...p1colors, ...p2colors]);
    
    // AAAB型: p1同色、p2異色で p1色を含む
    if (pat1[0] === pat1[1] && pat2[0] !== pat2[1] && p2colors.has(baseColor)) {
        return { type: 'AAAB', baseColor };
    }
    
    // AABB型: p1,p2ともに同色で色が異なる
    if (pat1[0] === pat1[1] && pat2[0] === pat2[1] && p1.mainColor !== p2.mainColor) {
        return { type: 'AABB', colorA: p1.mainColor, colorB: p2.mainColor };
    }
    
    // ABAB型: p1,p2ともに異色で同じペア
    if (pat1[0] !== pat1[1] && pat2[0] !== pat2[1] && pat1 === pat2) {
        return { type: 'ABAB', pair: pat1 };
    }
    
    // ABAC型: 異色ペア2個で3色構成
    const shared = p1colors.has(p2.mainColor) || p1colors.has(p2.subColor) ||
                   p2colors.has(p1.mainColor) || p2colors.has(p1.subColor);
    if (pat1[0] !== pat1[1] && pat2[0] !== pat2[1] && allColors.size === 3 && shared) {
        return { type: 'ABAC' };
    }
    
    // AABC型: p1同色、p2異色で p1色を含まない
    if (pat1[0] === pat1[1] && pat2[0] !== pat2[1] && !p2colors.has(baseColor)) {
        return { type: 'AABC', baseColor };
    }
    
    return null;
}

// ============ AAAB型の配置（Google Docs仕様） ============

function buildAAAB_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2];
    const baseColor = p1.mainColor;
    const otherColor = p2.mainColor === baseColor ? p2.subColor : p2.mainColor;
    
    if (turn === 1) {
        return placeHorizontal(board, p1, 1, true);
    }
    
    if (turn === 2) {
        return placeVertical(board, p2, 3, otherColor);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        if (s3 && u === otherColor) {
            return placeVertical(board, p3, 4, otherColor);
        }
        
        if (s3 && u === baseColor) {
            return placeHorizontal(board, p3, 4, true);
        }
        
        if (s3 && u !== baseColor && u !== otherColor) {
            return placeHorizontal(board, p3, 1, true);
        }
        
        if (!s3 && ((u === baseColor && v === otherColor) || (u === otherColor && v === baseColor))) {
            return placeVertical(board, p3, 4, baseColor);
        }
        
        if (!s3) {
            const cColor = (u === baseColor) ? v : u;
            return placeVertical(board, p3, 2, cColor);
        }
        
        if (!s3 && ((u === otherColor) || (v === otherColor))) {
            const cColor = (u === otherColor) ? v : u;
            return placeVertical(board, p3, 4, cColor);
        }
        
        const move = placeHorizontal(board, p3, 5, true);
        if (move) return move;
        return findPlacement(board, p3, colToX(6), 0);
    }
    
    return null;
}

// ============ AAAB型 3手目がBBの場合 ============

function buildAAAB_BB_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const baseColor = p1.mainColor;
    
    if (turn === 1) {
        return placeHorizontal(board, p1, 1, true);
    }
    
    if (turn === 2) {
        const otherColor = p2.mainColor === baseColor ? p2.subColor : p2.mainColor;
        return placeVertical(board, p2, 2, otherColor);
    }
    
    if (turn === 3) {
        const p3 = pieces[2];
        return placeVertical(board, p3, 1, p3.mainColor);
    }
    
    return null;
}

// ============ AABB型の配置（Google Docs仕様） ============

function buildAABB_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2];
    
    if (turn === 1) {
        return placeHorizontal(board, p1, 1, true);
    }
    
    if (turn === 2) {
        return placeHorizontal(board, p2, 1, true);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        if (s3) {
            return placeHorizontal(board, p3, 4, true);
        }
        
        return placeHorizontal(board, p3, 1, u === p1.mainColor);
    }
    
    return null;
}

// ============ ABAB型の配置（Google Docs仕様） ============

function buildABAB_Move(board, pieces, turn, variant = 1) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2];
    const pat1 = piecePattern(p1);
    
    const targetColorForVertical = (variant === 1) ? p1.mainColor : p1.subColor;
    
    if (turn === 1) {
        return placeVertical(board, p1, 1, targetColorForVertical);
    }
    
    if (turn === 2) {
        return placeVertical(board, p2, 2, targetColorForVertical);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        if (s3) {
            return placeHorizontal(board, p3, 4, true);
        }
        
        if (!s3 && ((u === p1.mainColor && v === p1.subColor) || 
                    (u === p1.subColor && v === p1.mainColor))) {
            const mainOnLeft = (u === p1.mainColor);
            return placeHorizontal(board, p3, 1, mainOnLeft);
        }
        
        if (!s3) {
            const cColor = (u === p1.mainColor || u === p1.subColor) ? v : u;
            return placeVertical(board, p3, 3, cColor);
        }
        
        const move = placeHorizontal(board, p3, 5, true);
        if (move) return move;
        return findPlacement(board, p3, colToX(6), 0);
    }
    
    return null;
}

// ============ ABAC型の配置（Google Docs仕様） ============

function buildABAC_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2];
    
    if (turn === 1) {
        return placeHorizontal(board, p1, 2, false);
    }
    
    if (turn === 2) {
        const aColor = p1.mainColor;
        return placeVertical(board, p2, 1, aColor) || placeHorizontal(board, p2, 2, false);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        if (s3) {
            return placeHorizontal(board, p3, 3, true);
        }
        
        const move = placeHorizontal(board, p3, 3, false);
        if (move) return move;
        return placeVertical(board, p3, 4, v) || placeVertical(board, p3, 3, u);
    }
    
    return null;
}

// ============ AABC型の配置（Google Docs仕様） ============

function buildAABC_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2];
    const baseColor = p1.mainColor;
    const [bColor, cColor] = [p2.mainColor, p2.subColor];
    
    if (turn === 1) {
        return placeHorizontal(board, p1, 1, true);
    }
    
    if (turn === 2) {
        const [a, b] = [p2.mainColor, p2.subColor];
        
        if (piecePattern(p2) === `${Math.min(bColor, cColor)}${Math.max(bColor, cColor)}`) {
            return placeHorizontal(board, p2, 3, false);
        }
        
        if ((a === baseColor && b !== baseColor) || (b === baseColor && a !== baseColor)) {
            return placeHorizontal(board, p2, 5, a !== baseColor);
        }
        
        if (a === b) {
            return placeHorizontal(board, p2, 5, true);
        }
        
        return placeHorizontal(board, p2, 3, false);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        if (s3 && u === baseColor) {
            return placeHorizontal(board, p3, 2, true);
        }
        
        if (s3) {
            return placeHorizontal(board, p3, 1, true);
        }
        
        return placeHorizontal(board, p3, 5, true) || findPlacement(board, p3, colToX(6), 0);
    }
    
    return null;
}

// ============ メイン: GTR優先の着手選択（色認識統合版） ============

function chooseOpeningBookMove_GTR(board, pieces) {
    if (!pieces || pieces.length < 2) return null;
    
    // ============ 新しい色認識ロジック ============
    const recognitionResult = recognizeAndConvertPieces(pieces);
    if (!recognitionResult) return null;
    
    const convertedPieces = recognitionResult.pieces;
    const colorMap = recognitionResult.colorMap;
    
    const occupied = countOccupied(board);
    const turn = Math.floor(occupied / 2) + 1;
    
    if (turn < 1 || turn > 3) return null;
    
    // ============ GTR型判定（アルファベット変換後） ============
    const gtrInfo = detectGTRType(convertedPieces);
    if (!gtrInfo) return null;
    
    // 3手目がBBの特殊ケース判定（AAAB型）
    if (gtrInfo.type === 'AAAB' && turn <= 2) {
        const p3 = convertedPieces[2];
        if (p3 && p3.mainColor === p3.subColor && p3.mainColor === gtrInfo.otherColor) {
            return buildAAAB_BB_Move(board, convertedPieces, turn);
        }
    }
    
    switch (gtrInfo.type) {
        case 'AAAB':
            return buildAAAB_Move(board, convertedPieces, turn);
        case 'AABB':
            return buildAABB_Move(board, convertedPieces, turn);
        case 'ABAB':
            return buildABAB_Move(board, convertedPieces, turn, 1);
        case 'ABAC':
            return buildABAC_Move(board, convertedPieces, turn);
        case 'AABC':
            return buildAABC_Move(board, convertedPieces, turn);
        default:
            return null;
    }
}

// ============ 既存コード互換性 ============

function countOccupied(board) {
    let n = 0;
    for (let i = 0; i < board.length; i++) {
        if (board[i] !== 0) n++;
    }
    return n;
}
