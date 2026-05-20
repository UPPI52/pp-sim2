/* 
 * GTR優先AI改修版 - 座標系修正版
 * - 「X列目」は左から1,2,3,4,5,6 で数える
 * - 内部座標xは0,1,2,3,4,5に変換
 * - Google Docsの定義に完全に従う
 */

const WIDTH = 6;
const HEIGHT = 14;
const SEARCH_VISIBLE_HEIGHT = 12;

// ============ 座標変換（1-indexed → 0-indexed） ============

/**
 * 列番号を内部x座標に変換
 * 1列目 → x=0, 2列目 → x=1, ..., 6列目 → x=5
 */
function colToX(col0based) {
    return col0based - 1;
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

/**
 * 指定した2列（1-indexed）に横置き
 * 例: placePair(board, piece, 1, 2, 'main_left')
 * → 1列目にmain、2列目にsubを配置
 */
function placeHorizontal(board, piece, leftCol1based, mainOnLeft = true) {
    const x = colToX(leftCol1bases);
    if (mainOnLeft) {
        // main が左、sub が右 → rotation 1
        return findPlacement(board, piece, x, 1);
    } else {
        // sub が左、main が右 → rotation 3
        return findPlacement(board, piece, x, 3);
    }
}

/**
 * 指定した列（1-indexed）に縦置き
 * targetColor が下に来るように配置
 */
function placeVertical(board, piece, col1based, targetColorAtBottom) {
    const x = colToX(col1based);
    
    if (piece.mainColor === targetColorAtBottom) {
        // main が下 → rotation 0
        return findPlacement(board, piece, x, 0);
    }
    if (piece.subColor === targetColorAtBottom) {
        // sub が下 → rotation 2
        return findPlacement(board, piece, x, 2);
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
        // 1手目: AAを1,2列目に横置き
        return placeHorizontal(board, p1, 1, true);
    }
    
    if (turn === 2) {
        // 2手目: ABをBを下にして3列目に縦置き
        return placeVertical(board, p2, 3, otherColor);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        // 3手目がBB: 4列目に縦置き(下優先)
        if (s3 && u === otherColor) {
            return placeVertical(board, p3, 4, otherColor);
        }
        
        // 3手目がAA: 4,5列目に横置き
        if (s3 && u === baseColor) {
            return placeHorizontal(board, p3, 4, true);
        }
        
        // 3手目がCC: 1,2列目に横置き
        if (s3 && u !== baseColor && u !== otherColor) {
            return placeHorizontal(board, p3, 1, true);
        }
        
        // 3手目がAB: 4列目にA下縦置き
        if (!s3 && ((u === baseColor && v === otherColor) || (u === otherColor && v === baseColor))) {
            return placeVertical(board, p3, 4, baseColor);
        }
        
        // 3手目がAC: 2列目にC下縦置き
        if (!s3) {
            const cColor = (u === baseColor) ? v : u;
            return placeVertical(board, p3, 2, cColor);
        }
        
        // 3手目がBC: 4列目C下縦置き
        if (!s3 && ((u === otherColor) || (v === otherColor))) {
            const cColor = (u === otherColor) ? v : u;
            return placeVertical(board, p3, 4, cColor);
        }
        
        // 3手目がCD: 5,6列目に横置き or 6列目に縦置き
        // ここでは、4手目を見ない場合は5,6列目横置きをデフォルトに
        const move = placeHorizontal(board, p3, 5, true);
        if (move) return move;
        return findPlacement(board, p3, colToX(6), 0); // 6列目縦置き
    }
    
    return null;
}

// ============ AAAB型 3手目がBBの場合 ============

function buildAAAB_BB_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const baseColor = p1.mainColor;
    
    if (turn === 1) {
        // 1手目: AAを1,2列目に横置き
        return placeHorizontal(board, p1, 1, true);
    }
    
    if (turn === 2) {
        // 2手目: ABを2列目にB下の縦置き
        const otherColor = p2.mainColor === baseColor ? p2.subColor : p2.mainColor;
        return placeVertical(board, p2, 2, otherColor);
    }
    
    if (turn === 3) {
        // 3手目: BB を1列目に縦置き
        const p3 = pieces[2];
        return placeVertical(board, p3, 1, p3.mainColor); // 同色なのでどちらでもOK
    }
    
    return null;
}

// ============ ABAB型の配置（Google Docs仕様） ============

function buildABAB_Move(board, pieces, turn, variant = 1) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2];
    const pat1 = piecePattern(p1);
    
    // variant: 1 = A下, 2 = B下
    const targetColorForVertical = (variant === 1) ? p1.mainColor : p1.subColor;
    
    if (turn === 1) {
        // 1手目: 1列目にtargetColor下縦置き
        return placeVertical(board, p1, 1, targetColorForVertical);
    }
    
    if (turn === 2) {
        // 2手目: 2列目にtargetColor下縦置き
        return placeVertical(board, p2, 2, targetColorForVertical);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        // 3手目がAA/BB/CC: 4,5列目に横置き
        if (s3) {
            return placeHorizontal(board, p3, 4, true);
        }
        
        // 3手目がAB: 1,2列目にA右の横置き
        if (!s3 && ((u === p1.mainColor && v === p1.subColor) || 
                    (u === p1.subColor && v === p1.mainColor))) {
            const mainOnLeft = (u === p1.mainColor);
            return placeHorizontal(board, p3, 1, mainOnLeft);
        }
        
        // 3手目がAC: 3列目にC下縦置き
        if (!s3) {
            const cColor = (u === p1.mainColor || u === p1.subColor) ? v : u;
            return placeVertical(board, p3, 3, cColor);
        }
        
        // 3手目がCD: 5,6列目に横置き or 6列目に縦置き
        const move = placeHorizontal(board, p3, 5, true);
        if (move) return move;
        return findPlacement(board, p3, colToX(6), 0);
    }
    
    return null;
}

// ============ AABB型の配置（Google Docs仕様） ============

function buildAABB_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2];
    
    if (turn === 1) {
        // 1手目: AAを1,2列目に横置き
        return placeHorizontal(board, p1, 1, true);
    }
    
    if (turn === 2) {
        // 2手目: BBを1,2列目に横置き
        return placeHorizontal(board, p2, 1, true);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        // 3手目が同色: 4,5列目に横置き
        if (s3) {
            return placeHorizontal(board, p3, 4, true);
        }
        
        // 3手目が異色AB: 1,2列目にA右の横置き
        return placeHorizontal(board, p3, 1, u === p1.mainColor);
    }
    
    return null;
}

// ============ ABAC型の配置（Google Docs仕様） ============

function buildABAC_Move(board, pieces, turn) {
    const p1 = pieces[0];
    const p2 = pieces[1];
    const p3 = pieces[2];
    
    // ABAC型は2パターンある
    // パターン（ⅰ）: 1手目A左2,3列目、2手目A下1列目
    // パターン（ⅱ）: 1手目A下1列目、2手目A左2,3列目
    
    // 簡略版: パターン（ⅰ）を優先
    
    if (turn === 1) {
        // 1手目: A左の2,3列目横置き
        return placeHorizontal(board, p1, 2, false); // sub左
    }
    
    if (turn === 2) {
        // 2手目: A下の1列目縦置き
        const aColor = p1.mainColor;
        return placeVertical(board, p2, 1, aColor);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        if (s3) {
            // 3手目が同色: 3,4列目に横置き
            return placeHorizontal(board, p3, 3, true);
        }
        
        // 3手目が異色: 3,4列目横置き or 4列目縦置きなど
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
        // 1手目: AAを1,2列目に横置き
        return placeHorizontal(board, p1, 1, true);
    }
    
    if (turn === 2) {
        // 2手目: BCはBを右にして3,4列目に横置き
        // または他のパターンに対応
        const [a, b] = [p2.mainColor, p2.subColor];
        
        if (piecePattern(p2) === `${Math.min(bColor, cColor)}${Math.max(bColor, cColor)}`) {
            // BC: Bを右 → main左, sub右 = rotation 1
            return placeHorizontal(board, p2, 3, false); // sub左
        }
        
        // AB: Bを左 → 5,6列目横置き
        if ((a === baseColor && b !== baseColor) || (b === baseColor && a !== baseColor)) {
            return placeHorizontal(board, p2, 5, a !== baseColor);
        }
        
        // BB: 5,6列目横置き
        if (a === b) {
            return placeHorizontal(board, p2, 5, true);
        }
        
        // デフォルト
        return placeHorizontal(board, p2, 3, false);
    }
    
    if (turn === 3 && p3) {
        const [u, v] = [p3.mainColor, p3.subColor];
        const s3 = (u === v);
        
        if (s3 && u === baseColor) {
            // 3手目がAA: 2,3列目に横置き
            return placeHorizontal(board, p3, 2, true);
        }
        
        if (s3) {
            // 3手目がCC/DD: 1,2列目に横置き
            return placeHorizontal(board, p3, 1, true);
        }
        
        // 3手目が異色: 汎用
        return placeHorizontal(board, p3, 5, true) || findPlacement(board, p3, colToX(6), 0);
    }
    
    return null;
}

// ============ メイン: GTR優先の着手選択 ============

function chooseOpeningBookMove_GTR(board, pieces) {
    if (!pieces || pieces.length < 2) return null;
    
    const occupied = countOccupied(board);
    const turn = Math.floor(occupied / 2) + 1;
    
    if (turn < 1 || turn > 3) return null;
    
    const gtrInfo = detectGTRType(pieces);
    if (!gtrInfo) return null;
    
    // 3手目がBBの特殊ケース判定（AAAB型）
    if (gtrInfo.type === 'AAAB' && turn <= 2) {
        const p3 = pieces[2];
        if (p3 && p3.mainColor === p3.subColor && p3.mainColor === gtrInfo.otherColor) {
            return buildAAAB_BB_Move(board, pieces, turn);
        }
    }
    
    switch (gtrInfo.type) {
        case 'AAAB':
            return buildAAAB_Move(board, pieces, turn);
        case 'AABB':
            return buildAABB_Move(board, pieces, turn);
        case 'ABAB':
            return buildABAB_Move(board, pieces, turn, 1);
        case 'ABAC':
            return buildABAC_Move(board, pieces, turn);
        case 'AABC':
            return buildAABC_Move(board, pieces, turn);
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
