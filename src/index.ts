import { Context, Schema } from 'koishi'

export const name = 'rate-control'

export const using = ['database']

export const usage = `
强制让机器人发送消息之间的间隔大于等于指定数值  
> 例如原本机器人要连续发3条消息，间隔为100ms  
> 现在你设置了1000ms，那么机器人发送一条消息后，会1000ms后才发送下一条消息  
> 这个设置是全局的，所有会话都会生效，但消息发送之间的间隔按会话独立计算  

注意：使用过程中关闭插件可能会造成意想不到的问题（例如某条消息没发出去）
`

export interface Config {
  消息发送间隔: number
}

export const Config: Schema<Config> = Schema.object({
  消息发送间隔: Schema.number()
    .description("同一个会话内机器人发送消息的间隔，单位为ms")
    .required()
    .step(1)
})

export function apply(ctx: Context, config: Config) {
  let lastMessage = {}
  ctx.on("before-send", async (session) => {
    let now = Date.now()
    let timeDiff = now - (lastMessage[session.event.guild.id] ?? 0)
    if (timeDiff < config.消息发送间隔) {
      lastMessage[session.event.guild.id] = now + (config.消息发送间隔 - timeDiff)
      await wait(config.消息发送间隔 - timeDiff)
      return false
    }
    lastMessage[session.event.guild.id] = now
    return false
  })
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}