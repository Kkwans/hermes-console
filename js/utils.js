/**
 * utils.js — 工具函数
 */

const Utils = {
  /**
   * 格式化时间戳
   */
  formatTime(ts) {
    if (!ts) return '—';
    const d = new Date(typeof ts === 'number' ? ts * 1000 : ts);
    if (isNaN(d.getTime())) return '—';
    const pad = n => String(n).padStart(2, '0');
    return `${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  },

  /**
   * 脱敏 API Key
   */
  maskKey(key) {
    if (!key) return '未配置';
    if (key.length <= 8) return '****';
    return key.slice(0, 4) + '****' + key.slice(-4);
  },

  /**
   * 防抖
   */
  debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  /**
   * 解析 cron 表达式为中文
   */
  describeCron(expr) {
    if (!expr) return '未知';
    const parts = expr.trim().split(/\s+/);
    if (parts.length < 5) return expr;
    const [min, hour, dom, mon, dow] = parts;

    // Common patterns
    if (expr === '* * * * *') return '每分钟';
    if (min === '0' && hour === '*' && dom === '*' && mon === '*' && dow === '*') return '每小时整点';
    if (dom === '*' && mon === '*' && dow === '*') return `每天 ${hour.padStart(2,'0')}:${min.padStart(2,'0')}`;
    if (mon === '*' && dow === '*') return `每月 ${dom}日 ${hour.padStart(2,'0')}:${min.padStart(2,'0')}`;

    // Interval patterns
    const intervalMatch = expr.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (intervalMatch) return `每 ${intervalMatch[1]} 分钟`;

    const hourInterval = expr.match(/^\*\s+\*\/(\d+)\s+\*\s+\*\s+\*$/);
    if (hourInterval) return `每 ${hourInterval[1]} 小时`;

    return expr;
  },

  /**
   * 渠道图标映射
   */
  getChannelIcon(name) {
    const icons = {
      telegram: '✈️', discord: '🎮', slack: '💬', whatsapp: '📱',
      feishu: '🐦', email: '📧', signal: '🔒', matrix: '🔗',
      webchat: '🌐', api: '⚡', webhook: '🪝', sms: '📲',
      dingtalk: '🔔', wecom: '🏢', mattermost: '🐘',
    };
    const lower = (name || '').toLowerCase();
    for (const [key, icon] of Object.entries(icons)) {
      if (lower.includes(key)) return icon;
    }
    return '📡';
  },

  /**
   * 获取柱状图颜色
   */
  getBarColor(percent) {
    if (percent >= 90) return 'bar-red';
    if (percent >= 70) return 'bar-yellow';
    return 'bar-green';
  },

  /**
   * 读取 localStorage
   */
  store: {
    get(key, fallback = null) {
      try {
        const v = localStorage.getItem('hermes_' + key);
        return v ? JSON.parse(v) : fallback;
      } catch { return fallback; }
    },
    set(key, value) {
      try { localStorage.setItem('hermes_' + key, JSON.stringify(value)); } catch {}
    },
    del(key) {
      try { localStorage.removeItem('hermes_' + key); } catch {}
    }
  }
};
