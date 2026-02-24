const WORLD_WIDTH = 3200;
const WORLD_HEIGHT = 2400;
const VILLAIN_SPEED = 80;
const VILLAIN_ATTACK_RATE = 120;
const VILLAIN_ATTACK_RANGE = 90;
const PLAYER_ATTACK_RANGE = 80;
const PLAYER_INVINCIBILITY = 90;

class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.dpad = { up: false, down: false, left: false, right: false };
        this.playerHealth = 6; // 6 half-hearts = 3 full hearts
        this.isAttacking = false;
        this.isShielding = false;
        this.shieldOffset = 40;
        this.attackOffset = 50;
        this.nearDoorIndex = -1;
        this.interiorElements = null;
        this.villainHealth = 10; // 10 half-hearts = 5 full hearts
        this.villainMaxHealth = 10;
        this.villainAttackTimer = 0;
        this.playerHitTimer = 0;
        this.villainHitTimer = 0;
        this.villainDead = false;
        this.gameOverState = false;
    }

    preload() {
        this.load.image('player', 'assets/images/main-character.png');
    }

    create() {
        const { width, height } = this.scale;

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
        this.updatePlayerHearts();

        // Attack and shield buttons (bottom-right)
        this.createActionButtons();

        // Villain (verde bad guy)
        this.createVillain();
        this.createVillainHearts();

        // Spacebar attack shortcut
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

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
        const margin = 16;
        const halfBtn = btnSize / 2;
        // Ensure all buttons fit within screen bounds
        const cx = margin + halfBtn + btnSize + gap;
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
        const margin = 16;
        const heartSpacing = 34;
        const maxHearts = 3;
        this.heartDisplays = [];
        for (let i = 0; i < maxHearts; i++) {
            const hx = margin + i * heartSpacing + 14;
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

    updatePlayerHearts() {
        const maxHearts = 3;
        for (let i = 0; i < maxHearts; i++) {
            const halfValue = this.playerHealth - i * 2;
            if (halfValue >= 2) {
                this.heartDisplays[i].setText('♥').setColor('#e03030');
            } else if (halfValue === 1) {
                this.heartDisplays[i].setText('♥').setColor('#e08000');
            } else {
                this.heartDisplays[i].setText('♡').setColor('#444444');
            }
        }
    }

    createActionButtons() {
        const btnSize = 60;
        const gap = 14;
        const margin = 16;
        const { width, height } = this.scale;

        const btnY = height - margin - btnSize / 2;
        const attackX = width - margin - btnSize / 2;
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
        if (this.isAttacking || this.gameOverState) return;
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
        if (!this.villainDead && this.villainHitTimer <= 0) {
            const dist = Phaser.Math.Distance.Between(
                this.player.x + offsetX, this.player.y,
                this.villain.x, this.villain.y
            );
            if (dist < PLAYER_ATTACK_RANGE) {
                this.villainHealth = Math.max(0, this.villainHealth - 1);
                this.villainHitTimer = 30;
                this.tweens.add({
                    targets: this.villain,
                    alpha: 0,
                    duration: 80,
                    yoyo: true,
                    repeat: 2
                });
                if (this.villainHealth <= 0) {
                    this.defeatVillain();
                }
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

    createVillain() {
        // Build a verde (green) villain texture using graphics
        const villainW = 64;
        const villainH = 80;
        const gfx = this.add.graphics();
        gfx.fillStyle(0x22aa44, 1);
        gfx.fillRoundedRect(0, 0, villainW, villainH, 8);
        // Evil red eyes
        gfx.fillStyle(0xff2200, 1);
        gfx.fillCircle(20, 26, 8);
        gfx.fillCircle(44, 26, 8);
        gfx.fillStyle(0x000000, 1);
        gfx.fillCircle(22, 26, 4);
        gfx.fillCircle(46, 26, 4);
        // Menacing mouth
        gfx.fillStyle(0x880000, 1);
        gfx.fillRect(16, 52, 32, 12);
        gfx.fillStyle(0xffffff, 1);
        gfx.fillRect(18, 54, 6, 8);
        gfx.fillRect(28, 54, 6, 8);
        gfx.fillRect(38, 54, 6, 8);
        gfx.generateTexture('villain', villainW, villainH);
        gfx.destroy();

        const vx = Math.round(WORLD_WIDTH * 0.5);
        const vy = Math.round(WORLD_HEIGHT * 0.45);
        this.villain = this.physics.add.image(vx, vy, 'villain');
        this.villain.setCollideWorldBounds(true);
        this.villain.setDepth(5);

        // Villain collides with house walls
        this.houseZones.forEach(zone => {
            this.physics.add.collider(this.villain, zone);
        });
    }

    createVillainHearts() {
        const maxHearts = 5;
        this.villainHeartDisplays = [];
        for (let i = 0; i < maxHearts; i++) {
            const heart = this.add.text(0, 0, '♥', {
                fontSize: '20px',
                color: '#e03030',
                stroke: '#000000',
                strokeThickness: 2
            }).setOrigin(0.5).setDepth(20);
            this.villainHeartDisplays.push(heart);
        }
    }

    updateVillainHearts() {
        if (this.villainDead) {
            this.villainHeartDisplays.forEach(h => h.setVisible(false));
            return;
        }
        const maxHearts = 5;
        const spacing = 22;
        const totalW = (maxHearts - 1) * spacing;
        for (let i = 0; i < maxHearts; i++) {
            const hx = this.villain.x - totalW / 2 + i * spacing;
            const hy = this.villain.y - 60;
            this.villainHeartDisplays[i].setPosition(hx, hy);
            const halfValue = this.villainHealth - i * 2;
            if (halfValue >= 2) {
                this.villainHeartDisplays[i].setText('♥').setColor('#e03030');
            } else if (halfValue === 1) {
                this.villainHeartDisplays[i].setText('♥').setColor('#e08000');
            } else {
                this.villainHeartDisplays[i].setText('♡').setColor('#444444');
            }
        }
    }

    villainAttackPlayer() {
        this.villainAttackTimer = VILLAIN_ATTACK_RATE;
        this.playerHitTimer = PLAYER_INVINCIBILITY;
        this.playerHealth = Math.max(0, this.playerHealth - 1);
        this.updatePlayerHearts();

        // Flash player to show damage
        this.tweens.add({
            targets: this.player,
            alpha: 0,
            duration: 80,
            yoyo: true,
            repeat: 2
        });

        // Attack visual from villain
        const slash = this.add.text(
            this.player.x, this.player.y - 20,
            '💥',
            { fontSize: '30px' }
        ).setOrigin(0.5).setDepth(15);
        this.tweens.add({
            targets: slash,
            alpha: 0,
            y: slash.y - 30,
            duration: 400,
            onComplete: () => slash.destroy()
        });

        if (this.playerHealth <= 0) {
            this.gameOver();
        }
    }

    defeatVillain() {
        this.villainDead = true;
        this.tweens.add({
            targets: this.villain,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 600,
            ease: 'Power2',
            onComplete: () => {
                this.villain.setVisible(false);
                if (this.villain.body) this.villain.body.enable = false;
            }
        });

        const { width, height } = this.scale;
        this.add.text(width / 2, height / 2, '🎉 Villain Defeated!', {
            fontSize: '32px',
            color: '#ffd700',
            stroke: '#000000',
            strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    }

    gameOver() {
        this.gameOverState = true;
        this.player.setVelocity(0, 0);
        this.player.body.enable = false;
        const { width, height } = this.scale;
        this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setScrollFactor(0).setDepth(90);
        this.add.text(width / 2, height / 2, '💀 Game Over', {
            fontSize: '40px',
            color: '#ff3030',
            stroke: '#000000',
            strokeThickness: 5
        }).setOrigin(0.5).setScrollFactor(0).setDepth(100);
    }

    onResize(gameSize) {
        this.physics.world.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setBounds(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
        this.cameras.main.setDeadzone(gameSize.width * 0.4, gameSize.height * 0.4);
    }

    update() {
        // Freeze player while the house interior is open
        if (this.interiorElements) {
            this.player.setVelocity(0, 0);
            return;
        }

        // Stop all movement after game over
        if (this.gameOverState) return;

        // Spacebar attack
        if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
            this.performAttack();
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
        if (!this.villainDead) {
            if (this.villainAttackTimer > 0) this.villainAttackTimer--;
            if (this.playerHitTimer > 0) this.playerHitTimer--;
            if (this.villainHitTimer > 0) this.villainHitTimer--;

            const dx = this.player.x - this.villain.x;
            const dy = this.player.y - this.villain.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist >= VILLAIN_ATTACK_RANGE) {
                this.villain.setVelocity((dx / dist) * VILLAIN_SPEED, (dy / dist) * VILLAIN_SPEED);
                this.villain.setFlipX(dx < 0);
            } else {
                this.villain.setVelocity(0, 0);
                if (this.villainAttackTimer <= 0 && this.playerHitTimer <= 0) {
                    this.villainAttackPlayer();
                }
            }

            this.updateVillainHearts();
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
