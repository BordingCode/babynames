/* === Baby Names — Match Screen === */

const Match = (() => {
    let initialized = false;

    function init() {
        if (App.activeProfile < 0) return;
        updateProfileCards();
        if (!initialized) {
            initListeners();
            initialized = true;
        }
    }

    function updateProfileCards() {
        const profiles = App.getProfiles();
        const liked0 = App.getLiked(0);
        const liked1 = App.getLiked(1);

        document.getElementById('match-name-0').textContent = profiles[0];
        document.getElementById('match-name-1').textContent = profiles[1];
        document.getElementById('match-count-0').textContent = liked0.length + ' navne';
        document.getElementById('match-count-1').textContent = liked1.length + ' navne';
    }

    function findMatches() {
        const liked0 = new Set(App.getLiked(0));
        const liked1 = App.getLiked(1);
        return liked1.filter(id => liked0.has(id)).sort((a, b) => {
            return NAMES[a].name.localeCompare(NAMES[b].name, 'da');
        });
    }

    function showMatches() {
        const matches = findMatches();
        const resultsDiv = document.getElementById('match-results');
        const celebDiv = document.getElementById('match-celebration');
        const listDiv = document.getElementById('match-list');

        resultsDiv.classList.remove('hidden');
        celebDiv.classList.remove('hidden');

        document.getElementById('celebration-count').textContent = matches.length;

        // Show match list
        listDiv.innerHTML = '';
        if (matches.length === 0) {
            listDiv.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:20px;">Ingen matches endnu. Begge skal swipe flere navne!</p>';
        } else {
            matches.forEach(id => {
                const item = document.createElement('div');
                item.className = 'match-item';

                const nameSpan = document.createElement('span');
                nameSpan.className = 'match-item-name';
                nameSpan.textContent = NAMES[id].name;
                item.appendChild(nameSpan);

                const heart = document.createElement('span');
                heart.className = 'match-item-heart';
                heart.textContent = '♥';
                item.appendChild(heart);

                listDiv.appendChild(item);
            });

            // Confetti!
            if (matches.length > 0) launchConfetti();
        }

        if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    }

    // Export/Import
    function exportLiked() {
        const liked = App.getLiked(App.activeProfile);
        if (liked.length === 0) {
            alert('Du har ikke liket nogen navne endnu!');
            return;
        }

        // Bitfield encoding
        const bytes = new Uint8Array(Math.ceil(NAMES.length / 8));
        liked.forEach(id => {
            bytes[Math.floor(id / 8)] |= (1 << (id % 8));
        });

        // Base64 encode
        let binary = '';
        bytes.forEach(b => binary += String.fromCharCode(b));
        const code = btoa(binary);

        // Copy to clipboard
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code).then(() => {
                alert('Kopieret! Del denne kode med din partner:\n\n' + code.substring(0, 40) + '...');
            }).catch(() => {
                prompt('Kopiér denne kode og del den med din partner:', code);
            });
        } else {
            prompt('Kopiér denne kode og del den med din partner:', code);
        }
    }

    function importLiked() {
        // Show import modal
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.innerHTML = `
            <div class="modal">
                <h3>Importér partners favoritter</h3>
                <textarea placeholder="Indsæt koden her..."></textarea>
                <div class="modal-actions">
                    <button class="secondary-btn" id="btn-cancel-import">Annullér</button>
                    <button class="primary-btn" id="btn-do-import">Importér</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        document.getElementById('btn-cancel-import').addEventListener('click', () => {
            overlay.remove();
        });

        overlay.addEventListener('click', e => {
            if (e.target === overlay) overlay.remove();
        });

        document.getElementById('btn-do-import').addEventListener('click', () => {
            const code = overlay.querySelector('textarea').value.trim();
            if (!code) return;

            try {
                // Decode base64
                const binary = atob(code);
                const bytes = new Uint8Array(binary.length);
                for (let i = 0; i < binary.length; i++) {
                    bytes[i] = binary.charCodeAt(i);
                }

                // Extract liked IDs
                const imported = [];
                for (let id = 0; id < NAMES.length; id++) {
                    const byteIdx = Math.floor(id / 8);
                    const bitIdx = id % 8;
                    if (byteIdx < bytes.length && (bytes[byteIdx] & (1 << bitIdx))) {
                        imported.push(id);
                    }
                }

                // Merge with partner's existing likes (don't overwrite)
                const otherProfile = App.activeProfile === 0 ? 1 : 0;
                const existing = new Set(App.getLiked(otherProfile));
                let newCount = 0;
                imported.forEach(id => {
                    if (!existing.has(id)) newCount++;
                    existing.add(id);
                });
                App.setLiked(otherProfile, Array.from(existing));

                overlay.remove();
                updateProfileCards();
                alert('Importeret ' + newCount + ' nye favoritter fra din partner! (' + existing.size + ' i alt)');
            } catch (e) {
                alert('Ugyldig kode. Prøv igen.');
            }
        });
    }

    // Confetti
    function launchConfetti() {
        let canvas = document.getElementById('confetti-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'confetti-canvas';
            document.body.appendChild(canvas);
        }
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.pointerEvents = 'none';
        const ctx = canvas.getContext('2d');

        const colors = ['#E8A0BF', '#D4B5E6', '#A8C5A0', '#B8D4E3', '#FFD0A0', '#FF9999'];
        const particles = [];

        for (let i = 0; i < 80; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: -20 - Math.random() * 200,
                vx: (Math.random() - 0.5) * 4,
                vy: 2 + Math.random() * 4,
                size: 4 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * 360,
                rotSpeed: (Math.random() - 0.5) * 10,
                wobble: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.03 + Math.random() * 0.05
            });
        }

        let frame = 0;
        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;

            particles.forEach(p => {
                p.x += p.vx + Math.sin(p.wobble) * 0.5;
                p.y += p.vy;
                p.vy += 0.08; // gravity
                p.rotation += p.rotSpeed;
                p.wobble += p.wobbleSpeed;

                if (p.y < canvas.height + 20) {
                    alive = true;
                    ctx.save();
                    ctx.translate(p.x, p.y);
                    ctx.rotate(p.rotation * Math.PI / 180);
                    ctx.fillStyle = p.color;
                    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
                    ctx.restore();
                }
            });

            frame++;
            if (alive && frame < 300) {
                requestAnimationFrame(animate);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                canvas.remove();
            }
        }
        requestAnimationFrame(animate);
    }

    function initListeners() {
        document.getElementById('btn-find-matches').addEventListener('click', showMatches);
        document.getElementById('btn-export').addEventListener('click', exportLiked);
        document.getElementById('btn-import').addEventListener('click', importLiked);
    }

    return { init };
})();
