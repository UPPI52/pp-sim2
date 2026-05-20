/* 
 * GTR優先AI改修版
 * - 初手を必ずGTR土台に統一
 * - AAAB/ABAB/AABB/ABAC/AABC型に対応
 * - 3手目まで定型配置を強制
 */

// ============ GTR型判定とマッピング ============

function piecePattern(p) {
    if (!p) return null;
    const a = p.mainColor;
    const b = p.subColor;
    if (a === b) return `${a}${a}`; // AA, BB, CC, DD
    if (a < b) return `${a}${b}`;   // AB, AC, AD
    return `${b}${a}`;              // BA→AB
}

function detectGTRType(pieces) {
    if (!pieces || pieces.length < 2) return null;
    
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2] || null;
    
    const pat1 = piecePattern(p1);
    const pat2 = piecePattern(p2);
    
    // AAAB型: 1手目同色、2手目異色（1手目の色を含む）
    if (pat1 && pat1[0] === pat1[1]) {
        const baseColor = p1.mainColor;
        const colorsInP2 = new Set([p2.mainColor, p2.subColor]);
        if (colorsInP2.has(baseColor) && pat2[0] !== pat2[1]) {
            return { type: 'AAAB', base: baseColor };
        }
    }
    
    // AABB型: 1,2手目ともに同色で色が異なる
    if (pat1 && pat2 && 
        pat1[0] === pat1[1] && pat2[0] === pat2[1] && 
        p1.mainColor !== p2.mainColor) {
        return { type: 'AABB', colors: [p1.mainColor, p2.mainColor] };
    }
    
    // ABAB型: 1,2手目ともに異色で同じペア
    if (pat1 && pat2 && pat1 === pat2 && pat1[0] !== pat1[1]) {
        return { type: 'ABAB', pair: pat1 };
    }
    
    // ABAC型: 異色ペア2個で3色を構成
    const p1colors = new Set([p1.mainColor, p1.subColor]);
    const p2colors = new Set([p2.mainColor, p2.subColor]);
    const allColors = new Set([...p1colors, ...p2colors]);
    const shared = (p1.mainColor === p2.mainColor) || 
                   (p1.mainColor === p2.subColor) ||
                   (p1.subColor === p2.mainColor) ||
                   (p1.subColor === p2.subColor);
    
    if (pat1 && pat2 && pat1[0] !== pat1[1] && pat2[0] !== pat2[1] && 
        allColors.size === 3 && shared) {
        return { type: 'ABAC' };
    }
    
    // AABC型: 1手目同色、2手目異色（1手目の色と別色を含む）
    if (pat1 && pat1[0] === pat1[1] && pat2 && pat2[0] !== pat2[1]) {
        const baseColor = p1.mainColor;
        const colorsInP2 = new Set([p2.mainColor, p2.subColor]);
        if (!colorsInP2.has(baseColor)) {
            return { type: 'AABC', base: baseColor };
        }
    }
    
    return null;
}

// ============ GTR定型配置関数 ============

function verticalAtColWithBottom(board, piece, col0, bottomColor) {
    const x = col0 - 1;
    if (piece.mainColor === bottomColor) return findPlacement(board, piece, x, 0);
    if (piece.subColor === bottomColor) return findPlacement(board, piece, x, 2);
    return null;
}

function horizontalAtCols(board, piece, leftCol0, preferMainLeft = null) {
    const x = leftCol0 - 1;
    if (preferMainLeft === null) return findPlacement(board, piece, x, 1);
    if (preferMainLeft) return findPlacement(board, piece, x, 1);
    return findPlacement(board, piece, x, 3);
}

// ============ AAAB型のGTR組み方 ============

function buildAAAB_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1] || null;
    const p3 = pieces[2] || null;
    const baseColor = p1.mainColor;
    const otherColor = p2 ? (p2.mainColor === baseColor ? p2.subColor : p2.mainColor) : null;
    
    if (turn === 1) {
        // 1手目: AA を1,2列目に横置き
        return horizontalAtCols(board, p1, 1, true);
    }
    
    if (turn === 2) {
        // 2手目: AB を B下にして3列目に縦置き
        // otherColor（B）を下にする
        return verticalAtColWithBottom(board, p2, 3, otherColor);
    }
    
    if (turn === 3 && p3) {
        const pat3 = piecePattern(p3);
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v); // 3手目が同色
        
        // 3手目がBB: 1列目に縦置き
        if (s3 && u === otherColor) {
            return findPlacement(board, p3, 0, 0); // 1列目縦置き
        }
        
        // 3手目がCC: 1,2列目に横置き
        if (s3 && u !== baseColor && u !== otherColor) {
            return horizontalAtCols(board, p3, 1, true);
        }
        
        // 3手目がAA: 4,5列目に横置き
        if (s3 && u === baseColor) {
            return horizontalAtCols(board, p3, 4, true);
        }
        
        // 3手目がAB: 4列目にA下縦置き
        if (!s3 && (u === baseColor || v === baseColor)) {
            return verticalAtColWithBottom(board, p3, 4, baseColor);
        }
        
        // 3手目がAC: 2列目にC下縦置き
        if (!s3) {
            const cColor = (u === baseColor) ? v : u;
            return verticalAtColWithBottom(board, p3, 2, cColor);
        }
        
        // 3手目がBC: 4列目C下縦置き
        if (!s3 && (u === otherColor || v === otherColor)) {
            const cColor = (u === otherColor) ? v : u;
            return verticalAtColWithBottom(board, p3, 4, cColor);
        }
        
        // 3手目がCD: 5,6列目に横置き or 6列目に縦置き
        return horizontalAtCols(board, p3, 5, true) || findPlacement(board, p3, 5, 0);
    }
    
    return null;
}

// ============ AABB型のGTR組み方 ============

function buildAABB_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1] || null;
    const p3 = pieces[2] || null;
    const colorA = p1.mainColor;
    const colorB = p2 ? p2.mainColor : null;
    
    if (turn === 1) {
        // 1手目: AA を1,2列目に横置き
        return horizontalAtCols(board, p1, 1, true);
    }
    
    if (turn === 2) {
        // 2手目: BB を1,2列目に横置き
        return horizontalAtCols(board, p2, 1, true);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        // 3手目が同色の場合: 4,5列目に横置き
        if (s3) {
            return horizontalAtCols(board, p3, 4, true);
        }
        
        // 3手目が異色: AB型 → 1,2列目にA右の横置き
        return horizontalAtCols(board, p3, 1, u === colorA);
    }
    
    return null;
}

// ============ ABAB型のGTR組み方 ============

function buildABAB_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1] || null;
    const p3 = pieces[2] || null;
    
    if (turn === 1) {
        // 1手目: A下に1列目縦置き
        return verticalAtColWithBottom(board, p1, 1, p1.mainColor);
    }
    
    if (turn === 2) {
        // 2手目: A下に2列目縦置き
        return verticalAtColWithBottom(board, p2, 2, p1.mainColor);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        // 3手目が同色: 4,5列目に横置き
        if (s3) {
            return horizontalAtCols(board, p3, 4, true);
        }
        
        // 3手目がAB: 1,2列目にA右の横置き
        if ((u === p1.mainColor && v === p1.subColor) || 
            (u === p1.subColor && v === p1.mainColor)) {
            return horizontalAtCols(board, p3, 1, u === p1.mainColor);
        }
        
        // 3手目がCD: 5,6列目に横置き
        return horizontalAtCols(board, p3, 5, true) || findPlacement(board, p3, 5, 0);
    }
    
    return null;
}

// ============ ABAC型のGTR組み方 ============

function buildABAC_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1] || null;
    const p3 = pieces[2] || null;
    
    if (turn === 1) {
        // 1手目: A左で2,3列目に横置き
        return horizontalAtCols(board, p1, 2, false);
    }
    
    if (turn === 2) {
        // 2手目: A下で1列目縦置き
        const aColor = p1.mainColor;
        return verticalAtColWithBottom(board, p2, 1, aColor) || horizontalAtCols(board, p2, 2, false);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        if (s3) {
            // 3手目が同色: 3,4列目に横置き
            return horizontalAtCols(board, p3, 3, true);
        }
        
        // 3手目が異色: 汎用配置
        return horizontalAtCols(board, p3, 3, false) || 
               verticalAtColWithBottom(board, p3, 4, v) || 
               verticalAtColWithBottom(board, p3, 3, u);
    }
    
    return null;
}

// ============ AABC型のGTR組み方 ============

function buildAABC_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1] || null;
    const p3 = pieces[2] || null;
    const baseColor = p1.mainColor;
    
    if (turn === 1) {
        // 1手目: AA を1,2列目に横置き
        return horizontalAtCols(board, p1, 1, true);
    }
    
    if (turn === 2) {
        // 2手目: BC を3,4列目に横置き（Bを右）
        return horizontalAtCols(board, p2, 3, true);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        // 3手目がAA: 3,4列目に横置き
        if (s3 && u === baseColor) {
            return horizontalAtCols(board, p3, 3, true);
        }
        
        // 3手目がDD: 1,2列目に横置き
        if (s3 && u !== baseColor) {
            return horizontalAtCols(board, p3, 1, true);
        }
        
        // 3手目が異色: 5,6列目に横置き
        return horizontalAtCols(board, p3, 5, true) || findPlacement(board, p3, 5, 0);
    }
    
    return null;
}

// ============ メイン: GTR優先の着手選択 ============

function chooseOpeningBookMove_GTR(board, pieces) {
    if (!pieces || pieces.length < 2) return null;
    
    const occupied = countOccupied(board);
    const turn = Math.floor(occupied / 2) + 1;
    
    // 1～3手目のみをGTR定型で処理
    if (turn < 1 || turn > 3) return null;
    
    // GTR型を判定
    const gtrInfo = detectGTRType(pieces);
    if (!gtrInfo) return null;
    
    // 型ごとに標準配置を適用
    switch (gtrInfo.type) {
        case 'AAAB':
            return buildAAAB_Move(board, pieces, turn);
        case 'AABB':
            return buildAABB_Move(board, pieces, turn);
        case 'ABAB':
            return buildABAB_Move(board, pieces, turn);
        case 'ABAC':
            return buildABAC_Move(board, pieces, turn);
        case 'AABC':
            return buildAABC_Move(board, pieces, turn);
        default:
            return null;
    }
}

// ============ 既存コードとの互換性 ============

function countOccupied(board) {
    let n = 0;
    const WIDTH = 6;
    const HEIGHT = 14;
    for (let i = 0; i < board.length; i++) if (board[i] !== 0) n++;
    return n;
}

function findPlacement(board, piece, x, rotation) {
    const y = findRestY(board, piece, x, rotation);
    if (y === null) return null;
    return { x, y, rotation };
}

function findRestY(board, piece, x, rotation) {
    const WIDTH = 6;
    const HEIGHT = 14;
    const SEARCH_VISIBLE_HEIGHT = 12;
    
    let y = HEIGHT - 2;
    if (!canPlace(board, piece, x, y, rotation)) return null;
    
    while (y > 0 && canPlace(board, piece, x, y - 1, rotation)) {
        y--;
    }
    return y;
}

function canPlace(board, piece, x, y, rotation) {
    const WIDTH = 6;
    const HEIGHT = 14;
    const SEARCH_VISIBLE_HEIGHT = 12;
    const idx = (x, y) => y * WIDTH + x;
    const get = (board, x, y) => board[idx(x, y)];
    
    const coords = pieceCoords(piece, x, y, rotation);
    
    for (const c of coords) {
        if (c.x < 0 || c.x >= WIDTH || c.y < 0 || c.y >= HEIGHT) return false;
        if (c.y < SEARCH_VISIBLE_HEIGHT && get(board, c.x, c.y) !== 0) return false;
    }
    return true;
}

function pieceCoords(piece, x, y, rotation) {
    let sx = x, sy = y;
    
    if (rotation === 0) sy = y + 1;
    else if (rotation === 1) sx = x - 1;
    else if (rotation === 2) sy = y - 1;
    else if (rotation === 3) sx = x + 1;
    
    return [
        { x, y, color: piece.mainColor },
        { x: sx, y: sy, color: piece.subColor }
    ];
}

// ============ 使用方法 ============
// 
// puyo-ai-worker.js の chooseOpeningBookMove() 関数を置き換える:
// 
//     function chooseOpeningBookMove(board, pieces) {
//         return chooseOpeningBookMove_GTR(board, pieces);
//     }
//
