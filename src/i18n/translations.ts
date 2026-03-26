export type Language = 'en' | 'zh';

export const en = {
  'menu.title': 'INTERRUPT',
  'menu.subtitle': 'SYSTEM INITIALIZATION READY',
  'menu.difficulty': 'DIFFICULTY',
  'menu.difficulty.easy': 'EASY',
  'menu.difficulty.normal': 'NORMAL',
  'menu.difficulty.hard': 'HARD',
  'menu.difficultyDesc.easy': 'PLAYER TAKES 50% DAMAGE',
  'menu.difficultyDesc.normal': 'STANDARD DAMAGE',
  'menu.difficultyDesc.hard': 'PLAYER TAKES 150% DAMAGE • ENEMIES DODGE BULLETS',
  'menu.startGame': 'START GAME',
  'menu.uiComponents': 'UI COMPONENTS',
  'menu.language': 'LANG',

  'gameOver.title': 'SYSTEM FAILURE',
  'gameOver.finalScore': 'FINAL SCORE: {score}',
  'gameOver.creditsCollected': 'CREDITS COLLECTED: {credits}',
  'gameOver.reboot': 'REBOOT SYSTEM',

  'rotate.title': 'ROTATE DEVICE',
  'rotate.body': 'This game is designed to be played in landscape mode for the best experience.',
  'rotate.playAnyway': 'PLAY ANYWAY',

  'aria.toggleFullscreen': 'Toggle Fullscreen',

  'weapon.empty': 'EMPTY',
  'weapon.default': 'DEFAULT',
  'weapon.bounce_gun': 'BOUNCE GUN',

  'hud.score': 'SCORE',
  'hud.credits': 'CREDITS',
  'hud.auxShield': 'AUX.SHIELD',
  'hud.sysIntegrity': 'SYS.INTEGRITY',
  'hud.sysMap': 'SYS.MAP',

  'status.blind': 'BLIND',
  'status.stun': 'STUN',
  'status.poison': 'POISON',
  'status.burn': 'BURN',

  'skill.dash': 'DASH',
  'skill.bounce': 'BOUNCE',

  'uiPreview.title': 'UI COMPONENT LIBRARY',
  'uiPreview.close': 'CLOSE',
  'uiPreview.section.badges': 'Badges',
  'uiPreview.badge.active': 'Active',
  'uiPreview.badge.danger': 'Danger',
  'uiPreview.badge.warning': 'Warning',
  'uiPreview.badge.epic': 'Epic',
  'uiPreview.badge.offline': 'Offline',
  'uiPreview.section.progressBars': 'Progress Bars',
  'uiPreview.progress.hp': 'HP',
  'uiPreview.progress.shield': 'SHIELD',
  'uiPreview.progress.energy': 'ENERGY',
  'uiPreview.section.inputs': 'Inputs',
  'uiPreview.input.username': 'USERNAME',
  'uiPreview.input.usernamePlaceholder': 'Enter alias...',
  'uiPreview.input.password': 'PASSWORD',
  'uiPreview.input.passwordPlaceholder': 'Enter key...',
  'uiPreview.input.passwordError': 'Invalid access key',
  'uiPreview.section.glitchText': 'Glitch Text',
  'uiPreview.glitch.compromised': 'SYSTEM COMPROMISED',
  'uiPreview.glitch.uploading': 'UPLOADING VIRUS...',
} as const;

export type TranslationKey = keyof typeof en;

export const zh: Record<TranslationKey, string> = {
  'menu.title': '信令中断',
  'menu.subtitle': '系统初始化就绪',
  'menu.difficulty': '难度',
  'menu.difficulty.easy': '简单',
  'menu.difficulty.normal': '普通',
  'menu.difficulty.hard': '困难',
  'menu.difficultyDesc.easy': '玩家承受 50% 伤害',
  'menu.difficultyDesc.normal': '标准伤害',
  'menu.difficultyDesc.hard': '玩家承受 150% 伤害 • 敌人会闪避子弹',
  'menu.startGame': '开始游戏',
  'menu.uiComponents': 'UI 组件',
  'menu.language': '语言',

  'gameOver.title': '系统故障',
  'gameOver.finalScore': '最终得分：{score}',
  'gameOver.creditsCollected': '收集积分：{credits}',
  'gameOver.reboot': '系统重启',

  'rotate.title': '旋转设备',
  'rotate.body': '为了最佳体验，本游戏推荐横屏游玩。',
  'rotate.playAnyway': '仍然开始',

  'aria.toggleFullscreen': '切换全屏',

  'weapon.empty': '空',
  'weapon.default': '基础武器',
  'weapon.bounce_gun': '弹力枪',

  'hud.score': '分数',
  'hud.credits': '信用点',
  'hud.auxShield': '辅助护盾',
  'hud.sysIntegrity': '系统完整性',
  'hud.sysMap': '系统地图',

  'status.blind': '致盲',
  'status.stun': '眩晕',
  'status.poison': '中毒',
  'status.burn': '灼烧',

  'skill.dash': '冲刺',
  'skill.bounce': '反弹',

  'uiPreview.title': 'UI 组件库',
  'uiPreview.close': '关闭',
  'uiPreview.section.badges': '徽章',
  'uiPreview.badge.active': '启用',
  'uiPreview.badge.danger': '危险',
  'uiPreview.badge.warning': '警告',
  'uiPreview.badge.epic': '史诗',
  'uiPreview.badge.offline': '离线',
  'uiPreview.section.progressBars': '进度条',
  'uiPreview.progress.hp': '生命',
  'uiPreview.progress.shield': '护盾',
  'uiPreview.progress.energy': '能量',
  'uiPreview.section.inputs': '输入框',
  'uiPreview.input.username': '用户名',
  'uiPreview.input.usernamePlaceholder': '输入代号…',
  'uiPreview.input.password': '密码',
  'uiPreview.input.passwordPlaceholder': '输入密钥…',
  'uiPreview.input.passwordError': '密钥无效',
  'uiPreview.section.glitchText': '故障文本',
  'uiPreview.glitch.compromised': '系统已被入侵',
  'uiPreview.glitch.uploading': '正在上传病毒…',
};

export const translations: Record<Language, Record<TranslationKey, string>> = {
  en,
  zh,
};
