/**
 * api.js — Hermes API 通信层
 *
 * 所有请求通过 Python 后端代理（同源），Gateway 内部 API 也由后端转发
 * 浏览器不需要直接访问 Gateway，无 CORS 问题，无需手动输入 Token
 */

const HermesAPI = {
  // 后端代理地址（同源，无需配置）
  proxyBase: '',

  /**
   * 通用 fetch 封装
   */
  async fetch(url, options = {}) {
    try {
      const resp = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(options.headers || {}),
        },
      });
      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        throw new Error(`HTTP ${resp.status}: ${text.slice(0, 200)}`);
      }
      return await resp.json();
    } catch (err) {
      console.error(`API Error [${url}]:`, err);
      throw err;
    }
  },

  /**
   * 通过后端代理请求
   */
  async proxy(path, options = {}) {
    return this.fetch(`${this.proxyBase}/api${path}`, options);
  },

  // ========== 业务方法 ==========

  /** 测试连接 (通过后端代理) */
  async testConnection() {
    return this.proxy('/gateway/status');
  },

  /** 获取 Gateway 状态 (通过后端代理) */
  async getStatus() {
    return this.proxy('/gateway/status');
  },

  /** 重启 Gateway (通过后端代理) */
  async restartGateway() {
    return this.proxy('/gateway/restart', { method: 'POST' });
  },

  /** 获取配置 */
  async getConfig() {
    return this.proxy('/config');
  },

  /** 更新配置 */
  async updateConfig(config) {
    return this.proxy('/config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },

  /** 获取会话列表 */
  async getSessions() {
    return this.proxy('/sessions');
  },

  /** 获取会话详情和消息历史 */
  async getSessionDetail(id) {
    return this.proxy(`/sessions/${id}/messages`);
  },

  /** 删除会话 */
  async deleteSession(id) {
    return this.proxy(`/sessions/${id}`, { method: 'DELETE' });
  },

  /** 更新会话标题 */
  async updateSession(id, title) {
    return this.proxy(`/sessions/${id}`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  },

  /** 获取定时任务 */
  async getCronJobs() {
    return this.proxy('/cron');
  },

  /** 切换定时任务 */
  async toggleCron(id, enabled) {
    return this.proxy(`/cron/${id}/toggle`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
  },

  /** 立即执行定时任务 */
  async runCron(id) {
    return this.proxy(`/cron/${id}/run`, { method: 'POST' });
  },

  /** 删除定时任务 */
  async deleteCron(id) {
    return this.proxy(`/cron/${id}`, { method: 'DELETE' });
  },

  /** 获取技能列表 */
  async getSkills() {
    return this.proxy('/skills');
  },

  /** 获取系统信息 */
  async getSystemInfo() {
    return this.proxy('/system');
  },

  /** 获取日志 */
  async getLogs(lines = 200) {
    return this.proxy(`/logs?lines=${lines}`);
  },

  /** 获取内存数据 */
  async getMemory() {
    return this.proxy('/memory');
  },

  /** 获取插件列表 */
  async getPlugins() {
    return this.proxy('/plugins');
  },

  /** 切换模型 */
  async switchModel(provider, model) {
    return this.proxy('/model/switch', {
      method: 'POST',
      body: JSON.stringify({ provider, model }),
    });
  },
};
