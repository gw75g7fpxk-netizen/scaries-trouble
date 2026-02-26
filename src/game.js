const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 2400;

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.dpad = { up: false, down: false, left: false, right: false };
        this.playerHealth = 3;
        this.isAttacking = false;
        this.isShielding = false;
        this.shieldOffset = 40;
        this.attackOffset = 50;
        this.nearDoorIndex = -1;
        this.interiorElements = null;
        // Villain state
        this.villainHealth = 5;
        this.villainMaxHealth = 5;
        this.villainInvincible = false;
        this.villainFleeing = false;
        this.playerInvincible = false;
        this.villainNextAttackTime = 0;
    }

    preload() {
        this.load.image('player', 'assets/images/main-character.png');
    }

    create() {
        const { width, height } = this.scale;

        // Read safe area insets (for devices with notches/home bars)
        const rootStyle = getComputedStyle(document.documentElement);
        this.safeTop = parseFloat(rootStyle.getPropertyValue('--safe-top')) || 0;
        this.safeBottom = parseFloat(rootStyle.getPropertyValue('--safe-bottom')) || 0;

        // Grass background (covers the entire world)
        this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT / 2, WORLD_WIDTH, WORLD_HEIGHT, 0x5c8a3c);

        // Darker grass strip at the bottom of the world for depth
        this.add.rectangle(WORLD_WIDTH / 2, WORLD_HEIGHT - 20, WORLD_WIDTH, 40, 0x3d6b26);

        // Houses near the top
        this.createHouses();

        // Physics world bounds (full world size)
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

        // Player sprite - scale to fit while preserving aspect ratio
        // Start near the top-center of the world where houses are visible
        this.player = this.physics.add.image(WORLD_WIDTH / 2, Math.round(WORLD_HEIGHT * 0.15), 'player');
        const targetWidth = Math.min(120, width * 0.15);
        const aspectRatio = this.player.height / this.player.width;
        this.player.setDisplaySize(targetWidth, targetWidth * aspectRatio);
        this.player.setCollideWorldBounds(true);

        // Add collision between player and house walls
        this.houseZones.forEach(zone => {
            this.physics.add.collider(this.player, zone);
        });

        // Camera follows the player within world bounds
        // Deadzone lets the player move around before the camera scrolls (Zelda-style)
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.startFollow(this.player, true, 1, 1);
        this.cameras.main.setDeadzone(this.scale.width * 0.4, this.scale.height * 0.4);

        // Keyboard input
        this.cursors = this.input.keyboard.createCursorKeys();
        this.wasd = this.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        });

        // D-pad
        this.createDpad();

        // Health hearts (top-left)
        this.createHearts();

        // Attack and shield buttons (bottom-right)
        this.createActionButtons();

        // Villain
        this.createVillainTexture();
        this.createVillain();

        // Initial heart states
        this.updatePlayerHearts();

        // Resize listener
        this.scale.on('resize', this.onResize, this);
    }

    createHouses() {
        const houseW = 72;
        const houseH = 56;
        const roofH = 36;
        const wallColors = [0xc0704a, 0xa0b860, 0x6890c8];
        const roofColors = [0x8b2020, 0x5a7a20, 0x204880];
        const doorColor   = 0x6b3a1f;
        const windowColor = 0xd4eeff;
        const doorW = 14, doorH = 20;

        // Houses spread across the world at various positions
        const housePositions = [
            { cx: Math.round(WORLD_WIDTH * 0.10), baseY: Math.round(WORLD_HEIGHT * 0.08), colorIdx: 0 },
            { cx: Math.round(WORLD_WIDTH * 0.30), baseY: Math.round(WORLD_HEIGHT * 0.08), colorIdx: 1 },
            { cx: Math.round(WORLD_WIDTH * 0.50), baseY: Math.round(WORLD_HEIGHT * 0.08), colorIdx: 2 },
            { cx: Math.round(WORLD_WIDTH * 0.70), baseY: Math.round(WORLD_HEIGHT * 0.08), colorIdx: 0 },
            { cx: Math.round(WORLD_WIDTH * 0.90), baseY: Math.round(WORLD_HEIGHT * 0.08), colorIdx: 1 },
            { cx: Math.round(WORLD_WIDTH * 0.20), baseY: Math.round(WORLD_HEIGHT * 0.50), colorIdx: 2 },
            { cx: Math.round(WORLD_WIDTH * 0.80), baseY: Math.round(WORLD_HEIGHT * 0.50), colorIdx: 0 },
            { cx: Math.round(WORLD_WIDTH * 0.15), baseY: Math.round(WORLD_HEIGHT * 0.88), colorIdx: 1 },
            { cx: Math.round(WORLD_WIDTH * 0.50), baseY: Math.round(WORLD_HEIGHT * 0.88), colorIdx: 2 },
            { cx: Math.round(WORLD_WIDTH * 0.85), baseY: Math.round(WORLD_HEIGHT * 0.88), colorIdx: 0 },
        ];

        this.houseZones = [];
        this.houseDoors = [];
        this.openDoors = new Set();
        this.houseDoorGraphics = [];
        this.houseDoorButtons = [];

        housePositions.forEach(({ cx, baseY, colorIdx }, index) => {
            // Position the graphics object at the house location so camera culling works correctly
            const g = this.add.graphics({ x: cx, y: baseY });

            // All drawing coordinates are now relative to (cx, baseY)

            // Wall
            g.fillStyle(wallColors[colorIdx], 1);
            g.fillRect(-houseW / 2, 0, houseW, houseH);

            // Roof (triangle)
            g.fillStyle(roofColors[colorIdx], 1);
            g.fillTriangle(
                -houseW / 2 - 6, 0,
                houseW / 2 + 6, 0,
                0, -roofH
            );

            // Windows (two small squares)
            const winSize = 13;
            const winY = 12;
            g.fillStyle(windowColor, 1);
            g.fillRect(-houseW / 2 + 10, winY, winSize, winSize);
            g.fillRect(houseW / 2 - 10 - winSize, winY, winSize, winSize);

            // Outline
            g.lineStyle(2, 0x000000, 0.5);
            g.strokeRect(-houseW / 2, 0, houseW, houseH);

            // Driveway: small grass gap then a grey paved area in front of the house
            const driveSpacing = 8;
            const driveW = Math.round(houseW * 0.5);
            const driveH = 20;
            g.fillStyle(0x999999, 1);
            g.fillRect(-driveW / 2, houseH + driveSpacing, driveW, driveH);
            g.lineStyle(1, 0x777777, 0.8);
            g.strokeRect(-driveW / 2, houseH + driveSpacing, driveW, driveH);

            // Bushes in front of house (three bushes around the door area)
            g.fillStyle(0x2a7d1a, 1);
            g.fillCircle(-houseW / 2 + 9, houseH + 5, 8);
            g.fillCircle(houseW / 2 - 9, houseH + 5, 8);
            g.fillCircle(-doorW / 2 - 11, houseH + 5, 7);

            // For blue houses: two kids playing ball outside with a red ball
            if (colorIdx === 2) {
                const frontY = houseH + 52; // yard area below the house and bushes
                // Kid 1 (left)
                const k1x = -28;
                g.fillStyle(0xffcc88, 1);
                g.fillCircle(k1x, frontY - 14, 5);
                g.fillStyle(0xe03030, 1);
                g.fillRect(k1x - 4, frontY - 9, 8, 10);
                g.fillStyle(0x4040a0, 1);
                g.fillRect(k1x - 4, frontY + 1, 3, 7);
                g.fillRect(k1x + 1, frontY + 1, 3, 7);
                // Kid 2 (right)
                const k2x = 28;
                g.fillStyle(0xffcc88, 1);
                g.fillCircle(k2x, frontY - 14, 5);
                g.fillStyle(0x30a040, 1);
                g.fillRect(k2x - 4, frontY - 9, 8, 10);
                g.fillStyle(0x4040a0, 1);
                g.fillRect(k2x - 4, frontY + 1, 3, 7);
                g.fillRect(k2x + 1, frontY + 1, 3, 7);
                // Red ball between the kids
                g.fillStyle(0xff2020, 1);
                g.fillCircle(0, frontY - 6, 6);
                g.fillStyle(0xffffff, 0.5);
                g.fillCircle(-2, frontY - 8, 2);
            }

            // Door drawn in its own graphics so it can be toggled open/closed
            const dg = this.add.graphics({ x: cx, y: baseY });
            dg.fillStyle(doorColor, 1);
            dg.fillRect(-doorW / 2, houseH - doorH, doorW, doorH);
            this.houseDoorGraphics.push(dg);

            // Invisible static collision zone covering the house walls
            const zone = this.add.zone(cx, baseY + houseH / 2, houseW, houseH);
            this.physics.add.existing(zone, true);
            this.houseZones.push(zone);

            // Store the world-space door position (bottom-center of house wall)
            this.houseDoors.push({ x: cx, y: baseY + houseH });

            // Door button positioned above the roof peak, hidden until player is nearby
            const btn = this.createWorldDoorButton(cx, baseY - roofH - 14, index);
            btn.setVisible(false);
            this.houseDoorButtons.push(btn);
        });
    }

    createWorldDoorButton(x, y, houseIndex) {
        const btnW = 72, btnH = 28;
        const container = this.add.container(x, y);
        container.setDepth(5);

        const bg = this.add.graphics();
        bg.fillStyle(0x3a1a00, 0.92);
        bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 7);
        bg.lineStyle(2, 0xffd700, 1);
        bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 7);

        const text = this.add.text(0, 0, '🚪 Door', {
            fontSize: '14px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        container.add([bg, text]);

        const hitArea = new Phaser.Geom.Rectangle(-btnW / 2, -btnH / 2, btnW, btnH);
        container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

        container.on('pointerdown', () => {
            this.openDoor(houseIndex);
        });

        return container;
    }

    openDoor(houseIndex) {
        this.openDoors.add(houseIndex);

        // Redraw door as a dark open doorway
        const houseH = 56;
        const doorW = 14, doorH = 20;
        const dg = this.houseDoorGraphics[houseIndex];
        dg.clear();
        dg.fillStyle(0x1a0800, 1);
        dg.fillRect(-doorW / 2, houseH - doorH, doorW, doorH);

        this.showHouseInterior(houseIndex);
    }

    showHouseInterior(houseIndex) {
        // Only one interior view can be shown at a time
        if (this.interiorElements) return;

        const { width, height } = this.scale;
        this.interiorElements = [];

        // Dark overlay that blocks interaction with the game world
        const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85)
            .setScrollFactor(0).setDepth(50).setInteractive();
        this.interiorElements.push(overlay);

        // Room dimensions and position
        const roomW = Math.min(width * 0.85, 420);
        const roomH = Math.min(height * 0.72, 360);
        const rx = width / 2;
        const ry = height / 2 - 10;

        const room = this.add.graphics().setScrollFactor(0).setDepth(51);
        // Floor
        room.fillStyle(0xc8a068, 1);
        room.fillRect(rx - roomW / 2, ry - roomH / 2, roomW, roomH);
        // Upper wall strip
        room.fillStyle(0xd4b07a, 1);
        room.fillRect(rx - roomW / 2, ry - roomH / 2, roomW, roomH * 0.35);
        // Border
        room.lineStyle(4, 0x5a3a10, 1);
        room.strokeRect(rx - roomW / 2, ry - roomH / 2, roomW, roomH);
        // Baseboard
        room.lineStyle(3, 0x8b6020, 1);
        room.strokeRect(rx - roomW / 2 + 4, ry - roomH / 2 + roomH * 0.35, roomW - 8, roomH * 0.65 - 4);
        this.interiorElements.push(room);

        const furniture = this.add.graphics().setScrollFactor(0).setDepth(52);
        // Table
        furniture.fillStyle(0x6b3a1f, 1);
        furniture.fillRect(rx - 40, ry - 10, 80, 35);
        furniture.lineStyle(2, 0x3a1a00, 1);
        furniture.strokeRect(rx - 40, ry - 10, 80, 35);
        // Table legs
        furniture.fillStyle(0x4a2800, 1);
        furniture.fillRect(rx - 36, ry + 25, 8, 20);
        furniture.fillRect(rx + 28, ry + 25, 8, 20);
        // Chairs
        furniture.fillStyle(0x8b4513, 1);
        furniture.fillRect(rx - 64, ry, 22, 22);
        furniture.fillRect(rx + 42, ry, 22, 22);
        // Bookshelf on wall
        furniture.fillStyle(0x5a2d0c, 1);
        furniture.fillRect(rx - roomW / 2 + 16, ry - roomH / 2 + 8, 50, 70);
        furniture.lineStyle(1, 0x000000, 0.6);
        furniture.strokeRect(rx - roomW / 2 + 16, ry - roomH / 2 + 8, 50, 70);
        // Books on shelf
        const bookColors = [0xe03030, 0x3070e0, 0x30a030, 0xe0a020];
        for (let b = 0; b < 4; b++) {
            furniture.fillStyle(bookColors[b], 1);
            furniture.fillRect(rx - roomW / 2 + 18 + b * 12, ry - roomH / 2 + 12, 10, 28);
        }
        // Window on wall
        furniture.fillStyle(0x8ab4d0, 1);
        furniture.fillRect(rx + 20, ry - roomH / 2 + 12, 50, 40);
        furniture.lineStyle(3, 0x5a3a10, 1);
        furniture.strokeRect(rx + 20, ry - roomH / 2 + 12, 50, 40);
        furniture.lineStyle(1, 0x5a3a10, 1);
        furniture.lineBetween(rx + 45, ry - roomH / 2 + 12, rx + 45, ry - roomH / 2 + 52);
        furniture.lineBetween(rx + 20, ry - roomH / 2 + 32, rx + 70, ry - roomH / 2 + 32);
        this.interiorElements.push(furniture);

        const title = this.add.text(rx, ry - roomH / 2 - 18, '🏠 Inside the House', {
            fontSize: '18px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5).setScrollFactor(0).setDepth(53);
        this.interiorElements.push(title);

        // Exit button
        const exitBtnW = 80, exitBtnH = 34;
        const exitX = rx;
        const exitY = ry + roomH / 2 + 22;

        const exitBg = this.add.graphics().setScrollFactor(0).setDepth(53);
        exitBg.fillStyle(0x8b1a1a, 0.95);
        exitBg.fillRoundedRect(exitX - exitBtnW / 2, exitY - exitBtnH / 2, exitBtnW, exitBtnH, 8);
        exitBg.lineStyle(2, 0xffffff, 0.7);
        exitBg.strokeRoundedRect(exitX - exitBtnW / 2, exitY - exitBtnH / 2, exitBtnW, exitBtnH, 8);
        this.interiorElements.push(exitBg);

        const exitText = this.add.text(exitX, exitY, '✕ Exit', {
            fontSize: '16px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5).setScrollFactor(0).setDepth(54)
            .setInteractive(new Phaser.Geom.Rectangle(-exitBtnW / 2, -exitBtnH / 2, exitBtnW, exitBtnH), Phaser.Geom.Rectangle.Contains);
        exitText.on('pointerdown', () => this.closeHouseInterior());
        this.interiorElements.push(exitText);
    }

    closeHouseInterior() {
        if (!this.interiorElements) return;
        this.interiorElements.forEach(el => el.destroy());
        this.interiorElements = null;
    }

    createDpad() {
        const btnSize = 52;
        const gap = 6;
        const baseMargin = 16;
        const margin = baseMargin + this.safeBottom;
        const halfBtn = btnSize / 2;
        // Ensure all buttons fit within screen bounds
        const cx = baseMargin + halfBtn + btnSize + gap;
        const cy = this.scale.height - margin - halfBtn - btnSize - gap;

        const positions = [
            { x: cx,             y: cy - btnSize - gap, dir: 'up',    label: '▲' },
            { x: cx - btnSize - gap, y: cy,             dir: 'left',  label: '◀' },
            { x: cx + btnSize + gap, y: cy,             dir: 'right', label: '▶' },
            { x: cx,             y: cy + btnSize + gap, dir: 'down',  label: '▼' }
        ];

        this.dpadButtons = {};

        positions.forEach(({ x, y, dir, label }) => {
            const container = this.add.container(x, y);
            container.setDepth(10);
            container.setScrollFactor(0);

            const bg = this.add.graphics();
            bg.fillStyle(0x222222, 0.75);
            bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
            bg.lineStyle(2, 0xffffff, 0.4);
            bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);

            const text = this.add.text(0, 0, label, {
                fontSize: '22px',
                color: '#ffffff',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5);

            container.add([bg, text]);

            const hitArea = new Phaser.Geom.Rectangle(-btnSize / 2, -btnSize / 2, btnSize, btnSize);
            container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

            container.on('pointerdown', () => {
                this.dpad[dir] = true;
                bg.clear();
                bg.fillStyle(0x555555, 0.9);
                bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
                bg.lineStyle(2, 0xffffff, 0.8);
                bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
            });

            const release = () => {
                this.dpad[dir] = false;
                bg.clear();
                bg.fillStyle(0x222222, 0.75);
                bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
                bg.lineStyle(2, 0xffffff, 0.4);
                bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 10);
            };

            container.on('pointerup', release);
            container.on('pointerout', release);

            this.dpadButtons[dir] = container;
        });

        // Allow multi-touch for simultaneous D-pad presses
        this.input.addPointer(3);
    }

    createHearts() {
        const baseMargin = 16;
        const margin = baseMargin + this.safeTop;
        const heartSpacing = 34;
        const maxHearts = 3;
        this.heartDisplays = [];
        for (let i = 0; i < maxHearts; i++) {
            const hx = baseMargin + i * heartSpacing + 14;
            const hy = margin + 14;
            const heart = this.add.text(hx, hy, '♥', {
                fontSize: '28px',
                color: '#e03030',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5).setDepth(20).setScrollFactor(0);
            this.heartDisplays.push(heart);
        }
    }

    createActionButtons() {
        const baseMargin = 16;
        const btnSize = 60;
        const gap = 14;
        const { width, height } = this.scale;

        const btnY = height - (baseMargin + this.safeBottom) - btnSize / 2;
        const attackX = width - baseMargin - btnSize / 2;
        const shieldX = attackX - btnSize - gap;

        this.createActionButton(attackX, btnY, '⚔', 0x8b1a1a, 'attack');
        this.createActionButton(shieldX, btnY, '🛡', 0x1a3a8b, 'shield');
    }

    createActionButton(x, y, label, color, action) {
        const btnSize = 60;
        const container = this.add.container(x, y);
        container.setDepth(10);
        container.setScrollFactor(0);

        const bg = this.add.graphics();
        bg.fillStyle(color, 0.75);
        bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 12);
        bg.lineStyle(2, 0xffffff, 0.4);
        bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 12);

        const text = this.add.text(0, 0, label, {
            fontSize: '26px',
            color: '#ffffff',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);

        container.add([bg, text]);

        const hitArea = new Phaser.Geom.Rectangle(-btnSize / 2, -btnSize / 2, btnSize, btnSize);
        container.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);

        container.on('pointerdown', () => {
            bg.clear();
            bg.fillStyle(color, 1.0);
            bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 12);
            bg.lineStyle(2, 0xffffff, 0.8);
            bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 12);

            if (action === 'attack') {
                this.performAttack();
            } else if (action === 'shield') {
                this.isShielding = true;
                this.showShield();
            }
        });

        const release = () => {
            bg.clear();
            bg.fillStyle(color, 0.75);
            bg.fillRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 12);
            bg.lineStyle(2, 0xffffff, 0.4);
            bg.strokeRoundedRect(-btnSize / 2, -btnSize / 2, btnSize, btnSize, 12);

            if (action === 'shield') {
                this.isShielding = false;
                this.hideShield();
            }
        };

        container.on('pointerup', release);
        container.on('pointerout', release);
    }

    performAttack() {
        if (this.isAttacking) return;
        this.isAttacking = true;

        const offsetX = this.player.flipX ? -this.attackOffset : this.attackOffset;
        const sword = this.add.text(
            this.player.x + offsetX,
            this.player.y,
            '⚔',
            { fontSize: '36px', color: '#ffffff', stroke: '#000000', strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(15);

        const startAngle = this.player.flipX ? 60 : -60;
        sword.setAngle(startAngle);

        // Check if villain is in attack range
        if (this.villain && this.villain.active) {
            const dx = this.villain.x - this.player.x;
            const dy = this.villain.y - this.player.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.attackOffset + 50) {
                this.hitVillain();
            }
        }

        this.tweens.add({
            targets: sword,
            angle: this.player.flipX ? -60 : 60,
            alpha: 0,
            duration: 350,
            ease: 'Power2',
            onComplete: () => {
                sword.destroy();
                this.isAttacking = false;
            }
        });
    }

    showShield() {
        if (this.shieldDisplay) return;
        const offsetX = this.player.flipX ? this.shieldOffset : -this.shieldOffset;
        this.shieldDisplay = this.add.text(
            this.player.x + offsetX,
            this.player.y,
            '🛡',
            { fontSize: '40px', stroke: '#000000', strokeThickness: 2 }
        ).setOrigin(0.5).setDepth(15);
    }

    hideShield() {
        if (this.shieldDisplay) {
            this.shieldDisplay.destroy();
            this.shieldDisplay = null;
        }
    }

    // ── Villain ──────────────────────────────────────────────────────────────

    createVillainTexture() {
        if (this.textures.exists('villain')) return;
        const w = 64, h = 80;
        const gfx = this.add.graphics();
        // Shadow
        gfx.fillStyle(0x000000, 0.2);
        gfx.fillEllipse(w / 2, h - 4, 44, 12);
        // Legs
        gfx.fillStyle(0x1a6c10, 1);
        gfx.fillRect(w / 2 - 14, h / 2 + 22, 12, 20);
        gfx.fillRect(w / 2 + 2,  h / 2 + 22, 12, 20);
        // Body
        gfx.fillStyle(0x2d8a1e, 1);
        gfx.fillRect(w / 2 - 17, h / 2 - 2, 34, 26);
        // Arms
        gfx.fillRect(w / 2 - 29, h / 2,     14, 10);
        gfx.fillRect(w / 2 + 15, h / 2,     14, 10);
        // Neck
        gfx.fillStyle(0x3aad28, 1);
        gfx.fillRect(w / 2 - 6,  h / 2 - 12, 12, 12);
        // Head
        gfx.fillCircle(w / 2, h / 2 - 20, 20);
        // Horns
        gfx.fillStyle(0x1a5c10, 1);
        gfx.fillTriangle(w/2 - 16, h/2 - 32, w/2 - 8,  h/2 - 32, w/2 - 12, h/2 - 46);
        gfx.fillTriangle(w/2 + 8,  h/2 - 32, w/2 + 16, h/2 - 32, w/2 + 12, h/2 - 46);
        // Eyes (red)
        gfx.fillStyle(0xff2020, 1);
        gfx.fillCircle(w / 2 - 8, h / 2 - 22, 5);
        gfx.fillCircle(w / 2 + 8, h / 2 - 22, 5);
        // Eye shine
        gfx.fillStyle(0xffffff, 1);
        gfx.fillCircle(w / 2 - 7, h / 2 - 23, 2);
        gfx.fillCircle(w / 2 + 9, h / 2 - 23, 2);
        gfx.generateTexture('villain', w, h);
        gfx.destroy();
    }

    createVillain() {
        const spawnX = Math.round(WORLD_WIDTH * 0.6);
        const spawnY = Math.round(WORLD_HEIGHT * 0.35);
        this.villain = this.physics.add.image(spawnX, spawnY, 'villain');
        const vw = Math.min(90, this.scale.width * 0.12);
        const ar = this.villain.height / this.villain.width;
        this.villain.setDisplaySize(vw, vw * ar);
        this.villain.setCollideWorldBounds(true);

        // Villain heart display (world space, shown above villain)
        this.villainHeartDisplays = [];
        for (let i = 0; i < this.villainMaxHealth; i++) {
            const hObj = this.add.text(0, 0, '♥', {
                fontSize: '18px',
                color: '#e03030',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5).setDepth(17);
            this.villainHeartDisplays.push(hObj);
        }
        this.updateVillainHeartPositions();
        this.updateVillainHearts();
    }

    updatePlayerHearts() {
        if (!this.heartDisplays) return;
        this.heartDisplays.forEach((heart, i) => {
            const v = this.playerHealth - i;
            if (v >= 1) {
                heart.setColor('#e03030'); // full – red
            } else if (v >= 0.5) {
                heart.setColor('#ff9999'); // half – light red
            } else {
                heart.setColor('#888888'); // empty – gray
            }
        });
    }

    updateVillainHearts() {
        if (!this.villainHeartDisplays) return;
        this.villainHeartDisplays.forEach((heart, i) => {
            const v = this.villainHealth - i;
            if (v >= 1) {
                heart.setColor('#e03030');
            } else if (v >= 0.5) {
                heart.setColor('#ff9999');
            } else {
                heart.setColor('#888888');
            }
        });
    }

    updateVillainHeartPositions() {
        if (!this.villain || !this.villainHeartDisplays || this.villainHeartDisplays.length === 0) return;
        const count = this.villainHeartDisplays.length;
        const spacing = 20;
        const startX = this.villain.x - ((count - 1) * spacing) / 2;
        const y = this.villain.y - this.villain.displayHeight / 2 - 16;
        this.villainHeartDisplays.forEach((heart, i) => {
            heart.setPosition(startX + i * spacing, y);
        });
    }

    hitVillain() {
        if (this.villainInvincible || !this.villain || !this.villain.active) return;
        this.villainHealth = Math.max(0, this.villainHealth - 0.5);
        this.updateVillainHearts();

        // Flash villain white briefly
        this.tweens.add({
            targets: this.villain,
            alpha: 0.2,
            yoyo: true,
            duration: 80,
            repeat: 2,
            onComplete: () => { if (this.villain) this.villain.setAlpha(1); }
        });

        this.villainInvincible = true;

        if (this.villainHealth <= 0) {
            this.villainDie();
        } else {
            this.time.delayedCall(500, () => { this.villainInvincible = false; });
        }
    }

    villainDie() {
        const poof = this.add.text(this.villain.x, this.villain.y, '💨', {
            fontSize: '52px'
        }).setDepth(25).setOrigin(0.5);
        this.tweens.add({
            targets: poof,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            y: this.villain.y - 80,
            duration: 800,
            onComplete: () => poof.destroy()
        });

        // Change villain to a scared yellow/orange color and make it flee
        this.villain.setTint(0xffcc00);
        this.villainFleeing = true;
        this.villainInvincible = true;

        // After fleeing, respawn from the opposite side of the world with full health
        this.time.delayedCall(2000, () => {
            if (!this.villain) return;
            const spawnX = this.player.x < WORLD_WIDTH / 2
                ? WORLD_WIDTH - 200
                : 200;
            const spawnY = Phaser.Math.Between(
                Math.round(WORLD_HEIGHT * 0.1),
                Math.round(WORLD_HEIGHT * 0.9)
            );
            this.villain.setPosition(spawnX, spawnY);
            this.villain.setVelocity(0, 0);
            this.villain.clearTint();
            this.villainFleeing = false;
            this.villainInvincible = false;
            this.villainHealth = this.villainMaxHealth;
            this.updateVillainHeartPositions();
            this.updateVillainHearts();
        });
    }

    villainAttackPlayer() {
        if (this.playerInvincible) return;

        // Attack flash at player position
        const flash = this.add.text(this.player.x, this.player.y, '💥', {
            fontSize: '40px'
        }).setDepth(25).setOrigin(0.5);
        this.tweens.add({
            targets: flash,
            alpha: 0,
            duration: 500,
            onComplete: () => flash.destroy()
        });

        this.playerHealth = Math.max(0, this.playerHealth - 0.5);
        this.updatePlayerHearts();

        // Flash player to signal damage
        this.tweens.add({
            targets: this.player,
            alpha: 0.3,
            yoyo: true,
            duration: 100,
            repeat: 3,
            onComplete: () => { if (this.player) this.player.setAlpha(1); }
        });

        this.playerInvincible = true;
        this.time.delayedCall(1000, () => { this.playerInvincible = false; });
    }

    // ── Resize ───────────────────────────────────────────────────────────────

    onResize(gameSize) {
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setDeadzone(gameSize.width * 0.4, gameSize.height * 0.4);
    }

    // ── Update loop ──────────────────────────────────────────────────────────

    update() {
        // Freeze player while the house interior is open
        if (this.interiorElements) {
            this.player.setVelocity(0, 0);
            return;
        }

        const speed = 220;
        let vx = 0;
        let vy = 0;

        if (this.cursors.left.isDown || this.wasd.left.isDown || this.dpad.left)  vx = -speed;
        if (this.cursors.right.isDown || this.wasd.right.isDown || this.dpad.right) vx = speed;
        if (this.cursors.up.isDown || this.wasd.up.isDown || this.dpad.up)   vy = -speed;
        if (this.cursors.down.isDown || this.wasd.down.isDown || this.dpad.down)  vy = speed;

        // Normalize diagonal movement
        if (vx !== 0 && vy !== 0) {
            const factor = 1 / Math.SQRT2;
            vx *= factor;
            vy *= factor;
        }

        this.player.setVelocity(vx, vy);

        // Flip sprite based on horizontal direction
        if (vx < 0) {
            this.player.setFlipX(true);
        } else if (vx > 0) {
            this.player.setFlipX(false);
        }

        // Keep shield display attached to the player
        if (this.shieldDisplay) {
            const offsetX = this.player.flipX ? this.shieldOffset : -this.shieldOffset;
            this.shieldDisplay.setPosition(this.player.x + offsetX, this.player.y);
        }

        // Villain AI
        if (this.villain && this.villain.active) {
            const dx = this.player.x - this.villain.x;
            const dy = this.player.y - this.villain.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (this.villainFleeing) {
                // Run away from player at high speed
                const fleeSpeed = 200;
                const nonZeroDist = dist || 1;
                this.villain.setVelocity(
                    (-dx / nonZeroDist) * fleeSpeed,
                    (-dy / nonZeroDist) * fleeSpeed
                );
                if (dx > 0) this.villain.setFlipX(true);
                else if (dx < 0) this.villain.setFlipX(false);
            } else {
                const villainSpeed = 100;
                const stopRange = 55;
                const attackRange = 80;

                if (dist > stopRange) {
                    this.villain.setVelocity(
                        (dx / dist) * villainSpeed,
                        (dy / dist) * villainSpeed
                    );
                } else {
                    this.villain.setVelocity(0, 0);
                }

                // Flip villain sprite based on direction of movement
                if (dx < 0) this.villain.setFlipX(true);
                else if (dx > 0) this.villain.setFlipX(false);

                // Villain attacks player when close enough
                const now = this.time.now;
                if (dist < attackRange && now > this.villainNextAttackTime) {
                    this.villainAttackPlayer();
                    this.villainNextAttackTime = now + 1500;
                }
            }

            // Keep villain heart display above villain
            this.updateVillainHeartPositions();
        }

        // Show door button when player is near a house door
        const doorProximity = 80;
        let nearIndex = -1;
        for (let i = 0; i < this.houseDoors.length; i++) {
            const door = this.houseDoors[i];
            if (Math.abs(this.player.x - door.x) < doorProximity &&
                Math.abs(this.player.y - door.y) < doorProximity) {
                nearIndex = i;
                break;
            }
        }

        if (nearIndex !== this.nearDoorIndex) {
            if (this.nearDoorIndex >= 0) {
                this.houseDoorButtons[this.nearDoorIndex].setVisible(false);
            }
            if (nearIndex >= 0) {
                this.houseDoorButtons[nearIndex].setVisible(true);
            }
            this.nearDoorIndex = nearIndex;
        }
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#5c8a3c',
    physics: {
        default: 'arcade',
        arcade: { gravity: { y: 0 }, debug: false }
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: GameScene
};

new Phaser.Game(config);
