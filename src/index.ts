import { Context, Schema, h } from 'koishi'

export const name = 'rate-control'

export const inject = ['database']

declare module 'koishi' {
  interface Tables {
      rateData: rateData
  }
}

export interface rateData {
  id: number;
  limit: number;
  guildId: string;
}

export const usage = `
强制让机器人发送消息之间的间隔大于等于指定数值  
配置项“全局消息发送间隔”说明：  
> 例如原本机器人要连续发3条消息，间隔为100ms  
> 现在你设置了1000ms，那么机器人发送一条消息后，会1000ms后才发送下一条消息  
> 这个设置是全局的，所有频道都会生效，但消息发送之间的间隔按频道独立计算  

指令使用说明：
> 设置消息间隔 <间隔>
>> 间隔单位为ms  
>> 该指令会在调用该指令的群聊覆盖全局消息发送间隔  
>> 仅支持在群聊使用  
>> 其余同全局消息发送间隔

注意：使用过程中关闭插件可能会造成意想不到的问题（例如某条消息没发出去）
`

export interface Config {
  全局消息发送间隔: number
  超级管理员: string[]
}

export const Config: Schema<Config> = Schema.object({
  全局消息发送间隔: Schema.number()
    .description("同一个频道内机器人发送消息的间隔，单位为ms")
    .required()
    .step(1),
  超级管理员: Schema.array(Schema.string())
    .description("允许控制消息发送间隔的人，每个项目放一个ID")
})

export function apply(ctx: Context, config: Config) {
  extendTable(ctx)
  let lastMessage = {}
  ctx.on("before-send", async (session) => {
    let now = Date.now()
    let timeDiff = now - (lastMessage[session.event.guild.id] ?? 0)
    let data = await ctx.database.get("rateData", { guildId: session.event.guild.id })
    let rateLimit = data[0]?.limit ?? config.全局消息发送间隔

    if (timeDiff < rateLimit) {
      lastMessage[session.event.guild.id] = now + (rateLimit - timeDiff)
      await wait(rateLimit - timeDiff)
      return false
    }

    lastMessage[session.event.guild.id] = now
    return false
  })

  ctx.guild().command("设置消息间隔 <rate:number>", "设置本群聊消息的发送间隔", {checkArgCount: true})
    .example("设置消息间隔 1000")
    .usage("参数单位为ms，此设置会覆盖全局消息发送间隔")
    .action(async ({session}, rate) => {
      if (config.超级管理员.includes(session.event.user.id)) {
        if (rate < 0) {
          return h("quote", session.event.message.id) + "消息间隔不能小于0ms"
        }
        let data = await ctx.database.get("rateData", {guildId: session.event.guild.id})
        if (data.length === 0) {
          await ctx.database.create("rateData", {
            limit: rate,
            guildId: session.event.guild.id
          })
        } else {
          await ctx.database.set("rateData", {guildId: session.event.guild.id}, {limit: rate})
        }
        return "本群消息发送间隔已设置为：" + rate + "ms"
      }
      return h("quote", session.event.message.id) + "你没有权限"
    })
}

async function wait(ms) {
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function extendTable(ctx) {
  await ctx.database.extend("rateData", {
    id: 'unsigned',
    limit: 'unsigned',
    guildId: 'text'
  }, {primary: "id", autoInc: true})
}