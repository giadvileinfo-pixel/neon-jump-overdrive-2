const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const music = document.getElementById('bgMusic');

let gameScale = 1;
const player = { x: 0, y: 0, size: 35, dy: 0, jumpForce: 8, angle: 0 };

// Caricamento Record
let highScore = parseInt(localStorage.getItem('neonJumpHS')) || 0;
document.getElementById('highScoreDisplay').innerText = "RECORD: " + highScore;

function updateScale() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    let baseScale = Math.min(canvas.width / 1100, canvas.height / 750);
    gameScale = Math.max(baseScale, 0.85); 
    player.size = 36 * gameScale;
    player.x = canvas.width * 0.15;
    player.jumpForce = 8.2 * gameScale; 
}

let bits = parseInt(localStorage.getItem('neonBits')) || 0;
let ownedSkins = JSON.parse(localStorage.getItem('ownedSkins')) || ['#0ff'];
let activeSkin = localStorage.getItem('activeSkin') || '#0ff';

let score = 0, level = 1, gameSpeed = 4, gameActive = false, frameCount = 0;
let obstacles = [], particles = [], currentGravity = 0.42;

const skins = [{ name: "CIANO", color: "#0ff", price: 0 }, { name: "ROSA", color: "#f0f", price: 50 }, { name: "VERDE", color: "#0f0", price: 100 }, { name: "ORO", color: "#ff0", price: 250 }, { name: "ROSSO", color: "#f00", price: 500 }];
const menus = { home: document.getElementById('homeMenu'), shop: document.getElementById('shopMenu'), settings: document.getElementById('settingsMenu'), gameOver: document.getElementById('gameOverMenu'), record: document.getElementById('recordMenu'), news: document.getElementById('newsMenu') };

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type, duration, vol = 0.05) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + duration);
}

class Particle {
    constructor(x, y, color, isTrail = false) {
        this.x = x; this.y = y;
        this.size = (isTrail ? Math.random() * 2.5 : Math.random() * 4 + 1) * gameScale;
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

function showNotice(msg, color = "#0ff") {
    const t = document.getElementById('notification-toast');
    t.innerText = msg; t.style.borderColor = color;
    t.classList.add('toast-visible');
    setTimeout(() => t.classList.remove('toast-visible'), 1500);
}

function startGame() { menus.home.style.display = 'none'; resetGame(); }

function resetGame() {
    score = 0; level = 1; gameSpeed = 4; obstacles = []; particles = [];
    player.y = canvas.height / 2; player.dy = 0;
    gameActive = true; frameCount = 0; currentGravity = 0.42;
    document.getElementById('score').innerText = "0";
    highScore = parseInt(localStorage.getItem('neonJumpHS')) || 0;
    document.getElementById('highScoreDisplay').innerText = "RECORD: " + highScore;
    menus.gameOver.style.display = "none";
    music.currentTime = 0; music.play().catch(()=>{});
    requestAnimationFrame(animate);
}

function gameOver() {
    gameActive = false; music.pause();
    playSound(60, 'sawtooth', 0.5, 0.15);
    if (score > highScore) {
        highScore = score;
        localStorage.setItem('neonJumpHS', highScore);
    }
    document.getElementById('finalScore').innerText = "PUNTEGGIO: " + score;
    menus.gameOver.style.display = "block";
}

function animate() {
    if (!gameActive) return;
    ctx.fillStyle = '#020205'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Griglia (Scorrimento fluido)
    ctx.strokeStyle = '#0e0e1f'; ctx.lineWidth = 1;
    let gridStep = 60 * gameScale;
    let gridOffset = (frameCount * (gameSpeed * 0.5)) % gridStep;
    for (let x = -gridOffset; x < canvas.width; x += gridStep) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }

    // Fisica
    player.dy += currentGravity * gameScale; player.y += player.dy;
    player.angle = Math.min(Math.PI/6, Math.max(-Math.PI/6, player.dy * 0.04));
    if (player.y + player.size > canvas.height || player.y < 0) gameOver();

    // Scia
    if (frameCount % 4 === 0) particles.push(new Particle(player.x, player.y + player.size/2, activeSkin, true));

    // GENERAZIONE OSTACOLI BILANCIATA
    let spawnRate = Math.max(50, 110 - (level * 5)); 
    if (frameCount % spawnRate === 0) {
        // Il gap si restringe ma rimane sempre giocabile
        const gap = Math.max(player.size * 2.5, (300 * gameScale) - (level * 10 * gameScale));
        const h = Math.random() * (canvas.height - gap - 120) + 60;
        const w = 65 * gameScale;
        obstacles.push({x: canvas.width, y: 0, w: w, h: h, type: 'pipe', scored: false});
        obstacles.push({x: canvas.width, y: h + gap, w: w, h: canvas.height, type: 'pipe'});
        if(Math.random() > 0.8) obstacles.push({x: canvas.width + 100 * gameScale, y: h + gap/2, type: 'bit'});
    }

    obstacles.forEach((obs, i) => {
        obs.x -= gameSpeed;
        const hitM = 6 * gameScale; 

        if (obs.type === 'pipe') {
            ctx.shadowBlur = 10; ctx.shadowColor = '#f0f'; ctx.fillStyle = '#f0f';
            ctx.beginPath(); ctx.roundRect(obs.x, obs.y, obs.w, obs.h, 10 * gameScale); ctx.fill();
            
            if (player.x + hitM < obs.x + obs.w && player.x + player.size - hitM > obs.x &&
                player.y + hitM < obs.y + obs.h && player.y + player.size - hitM > obs.y) gameOver();
            
            if (!obs.scored && obs.x + obs.w < player.x) {
                score++; obs.scored = true; 
                document.getElementById('score').innerText = score;
                
                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('neonJumpHS', highScore);
                    document.getElementById('highScoreDisplay').innerText = "RECORD: " + highScore;
                }

                // ACCELERAZIONE LINEARE OGNI 5 PUNTI
                if(score % 5 === 0) { 
                    level++; 
                    gameSpeed += 0.25; // Aumento fisso, non moltiplicato
                    currentGravity += 0.01; 
                    bits += 5; 
                    showNotice("LIVELLO " + level, "#0ff"); 
                    localStorage.setItem('neonBits', bits);
                }
            }
        } else {
            ctx.shadowBlur = 10; ctx.shadowColor = '#ff0'; ctx.fillStyle = '#ff0';
            ctx.beginPath(); ctx.arc(obs.x, obs.y, 8 * gameScale, 0, Math.PI*2); ctx.fill();
            if (Math.hypot(player.x + player.size/2 - obs.x, player.y + player.size/2 - obs.y) < 25 * gameScale) {
                bits++; playSound(1200, 'sine', 0.1); obstacles.splice(i, 1);
                localStorage.setItem('neonBits', bits);
            }
        }
        if (obs.x < -150) obstacles.splice(i, 1);
    });

    // Player
    ctx.save();
    ctx.translate(player.x + player.size/2, player.y + player.size/2);
    ctx.rotate(player.angle);
    ctx.shadowBlur = 20; ctx.shadowColor = activeSkin; ctx.fillStyle = activeSkin;
    ctx.beginPath(); ctx.roundRect(-player.size/2, -player.size/2, player.size, player.size, 6 * gameScale); ctx.fill();
    ctx.restore(); ctx.shadowBlur = 0;

    particles.forEach((p, i) => { p.update(); p.draw(); if (p.alpha <= 0) particles.splice(i, 1); });
    frameCount++; requestAnimationFrame(animate);
}

function handleJump(e) {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'SELECT') return;
    if (e.type === 'touchstart') e.preventDefault();
    if (gameActive) {
        player.dy = -player.jumpForce;
        playSound(400, 'sine', 0.1);
        for(let i=0; i<3; i++) particles.push(new Particle(player.x, player.y + player.size/2, activeSkin));
    }
}

window.addEventListener('mousedown', handleJump);
window.addEventListener('touchstart', handleJump, {passive: false});
window.addEventListener('keydown', (e) => { if(e.code === 'Space' || e.code === 'ArrowUp') handleJump(e); });
window.addEventListener('resize', updateScale);

function openShop() { menus.home.style.display = 'none'; menus.shop.style.display = 'block'; renderShop(); }
function closeShop() { menus.shop.style.display = 'none'; menus.home.style.display = 'block'; }
function renderShop() {
    const container = document.getElementById('skinContainer');
    document.getElementById('currencyDisplay').innerText = `BIT: ${bits}`;
    container.innerHTML = '';
    skins.forEach(s => {
        const isOwned = ownedSkins.includes(s.color);
        const isEquipped = activeSkin === s.color;
        const card = document.createElement('div');
        card.className = 'skin-card';
        card.style.border = "1px solid " + (isEquipped ? "#fff" : (isOwned ? s.color : "#444"));
        card.style.padding = "10px";
        card.style.borderRadius = "10px";
        card.style.textAlign = "center";
        card.innerHTML = `<div style="width:25px;height:25px;background:${s.color};margin:0 auto 5px;border-radius:4px"></div>
                          <div style="font-size:10px; color:white">${isEquipped ? 'USO' : (isOwned ? 'USA' : s.price)}</div>`;
        card.onclick = () => {
            if (isOwned) { activeSkin = s.color; localStorage.setItem('activeSkin', s.color); }
            else if (bits >= s.price) {
                bits -= s.price; ownedSkins.push(s.color);
                localStorage.setItem('neonBits', bits); localStorage.setItem('ownedSkins', JSON.stringify(ownedSkins));
                renderShop();
            }
        };
        container.appendChild(card);
    });
}
function showHighScore() { menus.home.style.display = 'none'; document.getElementById('recordValue').innerText = highScore; menus.record.style.display = 'block'; }
function closeRecord() { menus.record.style.display = 'none'; menus.home.style.display = 'block'; }
function backToHome() { menus.gameOver.style.display = 'none'; menus.home.style.display = 'block'; }
function openSettings() { menus.home.style.display = 'none'; menus.settings.style.display = 'block'; }
function closeSettings() { menus.settings.style.display = 'none'; menus.home.style.display = 'block'; }
function applySettings() { currentGravity = parseFloat(document.getElementById('difficulty').value); }
function showAuthor() { showNotice("Giuseppe Saracino", "#aaa"); }
function openNews() { menus.home.style.display = 'none'; menus.news.style.display = 'block'; }
function closeNews() { menus.news.style.display = 'none'; menus.home.style.display = 'block'; }

updateScale();
