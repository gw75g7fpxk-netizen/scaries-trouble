class GameScene extends Phaser.Scene {
    constructor() {
        super({ key: 'GameScene' });
        this.dpad = { up: false, down: false, left: false, right: false };
        this.playerHealth = 3;
        this.isAttacking = false;
        this.isShielding = false;
        this.shieldOffset = 40;
        this.attackOffset = 50;
    }

    preload() {
        this.load.image('player', 'assets/images/main-character.png');
    }

    create() {
        const { width, height } = this.scale;

        // Grass background
        this.add.rectangle(width / 2, height / 2, width, height, 0x5c8a3c);

        // Darker grass strip at the bottom for depth
        this.add.rectangle(width / 2, height - 20, width, 40, 0x3d6b26);

        // Houses near the top
        this.createHouses();

        // Physics world bounds
        this.physics.world.setBounds(0, 0, width, height);

        // Player sprite - scale to fit while preserving aspect ratio
        this.player = this.physics.add.image(width / 2, height / 2, 'player');
        const targetWidth = Math.min(120, width * 0.15);
        const aspectRatio = this.player.height / this.player.width;
        this.player.setDisplaySize(targetWidth, targetWidth * aspectRatio);
        this.player.setCollideWorldBounds(true);

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

        // Resize listener
        this.scale.on('resize', this.onResize, this);
    }

    createHouses() {
        const { width, height } = this.scale;
        const houseW = 72;
        const houseH = 56;
        const roofH = 36;
        const baseY = Math.round(height * 0.18);
        const positions = [
            Math.round(width * 0.18),
            Math.round(width * 0.50),
            Math.round(width * 0.82)
        ];
        const wallColors = [0xc0704a, 0xa0b860, 0x6890c8];
        const roofColors = [0x8b2020, 0x5a7a20, 0x204880];
        const doorColor   = 0x6b3a1f;
        const windowColor = 0xd4eeff;

        positions.forEach((cx, i) => {
            const g = this.add.graphics();

            // Wall
            g.fillStyle(wallColors[i], 1);
            g.fillRect(cx - houseW / 2, baseY, houseW, houseH);

            // Roof (triangle)
            g.fillStyle(roofColors[i], 1);
            g.fillTriangle(
                cx - houseW / 2 - 6, baseY,
                cx + houseW / 2 + 6, baseY,
                cx, baseY - roofH
            );

            // Door
            const doorW = 14, doorH = 20;
            g.fillStyle(doorColor, 1);
            g.fillRect(cx - doorW / 2, baseY + houseH - doorH, doorW, doorH);

            // Windows (two small squares)
            const winSize = 13;
            const winY = baseY + 12;
            g.fillStyle(windowColor, 1);
            g.fillRect(cx - houseW / 2 + 10, winY, winSize, winSize);
            g.fillRect(cx + houseW / 2 - 10 - winSize, winY, winSize, winSize);

            // Outline
            g.lineStyle(2, 0x000000, 0.5);
            g.strokeRect(cx - houseW / 2, baseY, houseW, houseH);
        });
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
            }).setOrigin(0.5).setDepth(20);
            this.heartDisplays.push(heart);
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

    onResize(gameSize) {
        const { width, height } = gameSize;
        this.physics.world.setBounds(0, 0, width, height);
    }

    update() {
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
