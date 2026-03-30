import type { AppEnv } from '../../types'
import { Hono } from 'hono'
import { getAria2Config, proxyAria2Rpc, updateAria2Config } from './handlers/aria2.handler'

const aria2Routes = new Hono<AppEnv>()

// 获取 Aria2 配置
aria2Routes.get('/config', getAria2Config)

// 更新 Aria2 配置
aria2Routes.put('/config', updateAria2Config)

// Aria2 RPC 代理（可选，用于解决跨域）
aria2Routes.post('/proxy', proxyAria2Rpc)

export default aria2Routes
