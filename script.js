const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const music = document.getElementById('bgMusic');

// --- STATO E PERSISTENZA ---
let bits = parseInt(localStorage.getItem('neonBits')) || 0;
let highScore = parseInt(localStorage.getItem('neonJumpHS')) || 0;
let ownedSkins = JSON.parse(localStorage.getItem('ownedSkins')) || ['#0ff'];
let activeSkin = localStorage.getItem('activeSkin') || '#0ff';

let score = 0, level = 1, gameSpeed = 5, gameActive = false, frameCount = 0;
let obstacles = [], particles = [], currentGravity = 0.5;

const menus = {
    home: document.getElementById('homeMenu'),
    shop: document.getElementById('shopMenu'),
    settings: document.getElementById('settingsMenu'),
    gameOver: document.getElementById('gameOverMenu'),
    record: document.getElementById('recordMenu'),
    news: document.getElementById('newsMenu')
};

const player = { x: 80, y: 0, size: 30, dy: 0, jumpForce: 9, angle: 0 };

const skins = [
    { name: "CIANO", color: "#0ff", price: 0 },
    { name: "ROSA", color: "#f0f", price: 50 },
    { name: "VERDE", color: "#0f0", price: 100 },
    { name: "ORO", color: "#ff0", price: 250 },
    { name: "ROSSO", color: "#f00", price: 500 }
];

// --- AUDIO ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type, duration, vol = 0.1, drop = false) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    if(drop) osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + duration);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

// --- PARTICELLE ---
class Particle {
    constructor(x, y, color, isTrail = false) {
        this.x = x; this.y = y;
        this.size = isTrail ? Math.random() * 5 : Math.random() * 3 + 1;
        this.speedX = isTrail ? -gameSpeed : (Math.random() - 0.5) * 8;
        this.speedY = isTrail ? (Math.random() - 0.5) * 2 : (Math.random() - 0.5) * 8;
        this.color = color; this.alpha = 1;
        this.decay = isTrail ? 0.05 : 0.02;
    }
    update() { this.x += this.speedX; this.y += this.speedY; this.alpha -= this.decay; }
    draw() {
        ctx.save(); ctx.globalAlpha = this.alpha; ctx.fillStyle = this.color;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    }
}

// --- LOGICA INTERFACCIA ---
function showNotice(msg, color = "#0ff") {
    const t = document.getElementById('notification-toast');
    t.innerText = msg; t.style.borderColor = color;
    t.classList.replace('toast-hidden', 'toast-visible');
    setTimeout(() => t.classList.replace('toast-visible', 'toast-hidden'), 2500);
}

function showAuthor() {
    playSound(880, 'sine', 0.2);
    showNotice("AUTORE: Giuseppe Saracino", "#aaa");
}

function openNews() { menus.home.style.display = 'none'; menus.news.style.display = 'block'; playSound(600, 'triangle', 0.1); }
function closeNews() { menus.news.style.display = 'none'; menus.home.style.display = 'block'; }
function openShop() { menus.home.style.display = 'none'; menus.shop.style.display = 'block'; renderShop(); }
function closeShop() { menus.shop.style.display = 'none'; menus.home.style.display = 'block'; }
function showHighScore() { menus.home.style.display = 'none'; document.getElementById('recordValue').innerText = highScore; menus.record.style.display = 'block'; }
function closeRecord() { menus.record.style.display = 'none'; menus.home.style.display = 'block'; }
function openSettings() { menus.home.style.display = 'none'; menus.settings.style.display = 'block'; }
function closeSettings() { menus.settings.style.display = 'none'; menus.home.style.display = 'block'; }
function applySettings() { currentGravity = parseFloat(document.getElementById('difficulty').value); }
function backToHome() { menus.gameOver.style.display = 'none'; menus.home.style.display = 'block'; }

function renderShop() {
    const container = document.getElementById('skinContainer');
    document.getElementById('currencyDisplay').innerText = `BIT: ${bits}`;
    container.innerHTML = '';
    skins.forEach(s => {
        const isOwned = ownedSkins.includes(s.color);
        const isEquipped = activeSkin === s.color;
        const card = document.createElement('div');
        card.className = 'skin-card';
        card.style.borderColor = isEquipped ? '#fff' : (isOwned ? s.color : '#444');
        card.innerHTML = `<div style="width:20px;height:20px;background:${s.color};margin:0 auto 5px;box-shadow:0 0 8px ${s.color}"></div>
                          <div style="font-size:10px;color:#fff">${isEquipped ? 'USO' : (isOwned ? 'USA' : s.price)}</div>`;
        card.onclick = () => {
            if (isOwned) { activeSkin = s.color; localStorage.setItem('activeSkin', s.color); playSound(600, 'sine', 0.1); }
            else if (bits >= s.price) {
                bits -= s.price; ownedSkins.push(s.color);
                localStorage.setItem('neonBits', bits); localStorage.setItem('ownedSkins', JSON.stringify(ownedSkins));
                playSound(800, 'triangle', 0.2); showNotice("SBLOCCATA!", "#0f0");
            } else { playSound(150, 'sawtooth', 0.2); showNotice("BIT INSUFFICIENTI", "#f00"); }
            renderShop();
        };
        container.appendChild(card);
    });
}

// --- GAME LOOP ---
function startGame() { menus.home.style.display = 'none'; resetGame(); }

function resetGame() {
    score = 0; level = 1; gameSpeed = 5; obstacles = []; particles = [];
    player.y = canvas.height / 2; player.dy = 0;
    gameActive = true; frameCount = 0;
    document.getElementById('score').innerText = "0";
    document.getElementById('highScoreDisplay').innerText = "RECORD: " + highScore;
    menus.gameOver.style.display = "none";
    music.currentTime = 0; music.play().catch(()=>{});
    requestAnimationFrame(animate);
}

function gameOver() {
    gameActive = false; music.pause();
    playSound(100, 'sawtooth', 0.5, 0.2, true);
    if (score > highScore) { highScore = score; localStorage.setItem('neonJumpHS', highScore); showNotice("NUOVO RECORD!", "#ff0"); }
    document.getElementById('finalScore').innerText = "PUNTEGGIO: " + score;
    menus.gameOver.style.display = "block";
}

function animate() {
    if (!gameActive) return;
    ctx.fillStyle = '#020205'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Griglia
    ctx.strokeStyle = '#111122'; ctx.lineWidth = 1;
    let gridOffset = (frameCount * (gameSpeed * 0.5)) % 50;
    for (let x = -gridOffset; x < canvas.width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    // Fisica
    player.dy += currentGravity; player.y += player.dy;
    player.angle = Math.min(Math.PI/4, Math.max(-Math.PI/4, player.dy * 0.05));
    if (player.y + player.size > canvas.height || player.y < 0) gameOver();

    // Scia
    if (frameCount % 2 === 0) particles.push(new Particle(player.x, player.y + player.size/2, activeSkin, true));

    // Ostacoli
    if (frameCount % Math.max(50, 90 - (level * 2)) === 0) {
        const gap = Math.max(160, 240 - (level * 5));
        const h = Math.random() * (canvas.height - gap - 100) + 50;
        obstacles.push({x: canvas.width, y: 0, w: 60, h: h, type: 'pipe', scored: false});
        obstacles.push({x: canvas.width, y: h + gap, w: 60, h: canvas.height, type: 'pipe'});
        if(Math.random() > 0.8) obstacles.push({x: canvas.width + 100, y: h + gap/2, w: 15, h: 15, type: 'bit'});
    }

    obstacles.forEach((obs, i) => {
        obs.x -= gameSpeed;
        const b = 5; 
        if (obs.type === 'pipe') {
            ctx.shadowBlur = 15; ctx.shadowColor = '#f0f'; ctx.fillStyle = '#f0f';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            if (player.x + b < obs.x + obs.w && player.x + player.size - b > obs.x &&
                player.y + b < obs.y + obs.h && player.y + player.size - b > obs.y) gameOver();
            if (!obs.scored && obs.x + obs.w < player.x) {
                score++; obs.scored = true; document.getElementById('score').innerText = score;
                if(score % 10 === 0) { level++; gameSpeed += 0.3; bits += 10; showNotice("LIVELLO " + level); }
            }
        } else {
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff0'; ctx.fillStyle = '#ff0';
            ctx.beginPath(); ctx.arc(obs.x, obs.y, 8, 0, Math.PI*2); ctx.fill();
            if (Math.hypot(player.x + player.size/2 - obs.x, player.y + player.size/2 - obs.y) < 25) {
                bits++; playSound(1000, 'sine', 0.1); obstacles.splice(i, 1);
                localStorage.setItem('neonBits', bits);
            }
        }
        if (obs.x < -100) obstacles.splice(i, 1);
    });

    // Giocatore
    ctx.save();
    ctx.translate(player.x + player.size/2, player.y + player.size/2);
    ctx.rotate(player.angle);
    ctx.shadowBlur = 20; ctx.shadowColor = activeSkin; ctx.fillStyle = activeSkin;
    ctx.fillRect(-player.size/2, -player.size/2, player.size, player.size);
    ctx.restore(); ctx.shadowBlur = 0;

    particles.forEach((p, i) => { p.update(); p.draw(); if (p.alpha <= 0) particles.splice(i, 1); });

    frameCount++; requestAnimationFrame(animate);
}

function handleJump(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
    if (e.type === 'touchstart') e.preventDefault();
    if (gameActive) {
        player.dy = -player.jumpForce;
        playSound(300, 'sine', 0.15);
        for(let i=0; i<5; i++) particles.push(new Particle(player.x, player.y + 15, activeSkin));
    }
}

window.addEventListener('mousedown', handleJump);
window.addEventListener('touchstart', handleJump, {passive: false});
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
canvas.width = window.innerWidth; canvas.height = window.innerHeight;