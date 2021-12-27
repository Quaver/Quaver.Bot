import * as Discord from "discord.js";
import Logger from "../logging/Logger";
import SqlDatabase from "../database/SqlDatabase";
const config = require("../config/config.json");

export default class Bot {
    /**
     * The client hused to interact with Discord.
     */
    public static Client: Discord.Client = new Discord.Client();

    /**
     * Initializes the Discord bot and logs it in
     */
    public static async Initialize(): Promise<void> {
        if (!config.bot.roleId)
            return Logger.Error(`Discord donator 'roleId' is not set in config.`);

        await Bot.Client.login(config.bot.token);
        Bot.StartWorkerTask();
        Bot.WatchMessages();
        Bot.WatchDeletedMessages();
    }

    /**
     * Gives the donator role to a Discord user
     * @param id
     */
    public static async GiveDonatorRole(id: any): Promise<void> {
        try {
            const user = await Bot.GetDiscordUser(id);

            if (user == null)
                return Logger.Warning(`Tried to give donator role to user: ${id}, but they are not in the server.`);

            const role = await Bot.GetDonatorRole();

            if (!role)
                return Logger.Warning(`Tried to give donator role to user: ${id}, but the role does not exist in the cache.`);

            await user.roles.add(role);
            Logger.Success(`Successfully added donator role to: ${id}!`);
        } catch (err) {
            Logger.Error(err);
        }
    }

    /**
     * Removes the donator role from a Discord user
     * @param id
     */
    public static async RemoveDonatorRole(id: any): Promise<void> {
        try {
            const user = await Bot.GetDiscordUser(id);

            if (user == null)
                return Logger.Warning(`Tried to remove donator role from user: ${id}, but they are not in the server.`);

            const role = await Bot.GetDonatorRole();

            if (!role)
                return Logger.Warning(`Tried to remove donator role from user: ${id}, but the role does not exist in the cache.`);

            await user.roles.remove(role);
            Logger.Success(`Successfully removed donator role from: ${id}!`);
        } catch (err) {
            Logger.Error(err);
        }
    }

    /**
     * Gets a Discord user at a particular id in the server.
     * @param id
     */
    public static async GetDiscordUser(id: any): Promise<any> {
        try {
            const chan: any = await Bot.GetGuild();

            const member = chan.member(id);
            return member;
        } catch(err) {
            Logger.Error(err);
            return null;
        }
    }

    /**
     * Gets the Quaver guild object
     */
    public static async GetGuild(): Promise<any> {
        try {
            const chan: any = await Bot.Client.channels.fetch(config.bot.generalChannelId);

            if (!chan)
                return null;

            return chan.guild;

        } catch (err) {
            Logger.Error(err);
            return null;
        }
    }

    /**
     * Gets the donator role object
     */
    public static async GetDonatorRole(): Promise<any> {
        try {
            const guild = await Bot.GetGuild();
            const role = guild.roles.cache.find(role => role.id == config.bot.roleId);

            return role;
        } catch (err) {
            Logger.Error(err);
            return null;
        }
    }

    /**
     * Periodically, the bot will perform checks to make sure people that have the donator role
     * should.
     */
    private static StartWorkerTask(): void {
        setInterval(async () => {
            await Bot.RemoveExpiredUserDonatorRole();
        }, 10000);
    }

    /**
     * On message
     */
    private static WatchMessages(): void {
        Bot.Client.on('message', message => {
            if(message.author.bot && config.webhookIdsReaction.includes(message.author.id)) {
                message.react("👍");
                message.react("👎");
                message.react("❓");
            } else {
                if(message.embeds && message.author.id !== config.bot.id) {
                    for(const embed of message.embeds) {
                        const title = embed.title?.toLowerCase();
                        const description = embed.description?.toLowerCase();

                        if((title && title.includes("nitro") && title.includes("free"))
                        || (description && description.includes("nitro") && description.includes("free"))) {
                            message.delete().then(r => {
                                Bot.Client.channels.cache.get(config.logChannelId)
                                    .send(`${message.author.tag} posted scam message.`);
                                Logger.Warning(`Scam message was deleted! ${embed.url}`);
                            });
                        }
                    }
                }
            }
        });
    }

    private static WatchDeletedMessages(): void {
        if(config.logChannelId) {
            Bot.Client.on('messageDelete', message => {
                if(config.logChannelId !== message.channel.id && !message.embeds.length) {
                    Bot.Client.channels.cache.get(config.logChannelId)
                        .send(`\`\`\`${message.content}\`\`\` was deleted by ${message.author?.tag} - ${message.author?.id}`);
                }
            });
        }
    }

    /**
     * Removes the donator role from users who have had their time expired.
     */
    private static async RemoveExpiredUserDonatorRole(): Promise<void> {
        try {
            // Get all users who have the donator role
            const role = await Bot.GetDonatorRole();

            role.members.map(async (user: any) => {
                try {
                    const result = await SqlDatabase.Execute("SELECT id, donator_end_time, usergroups FROM users WHERE discord_id = ? LIMIT 1", [user.id]);

                    // Couldn't find user, so remove them from the database.
                    if (result.length == 0) {
                        await user.roles.remove(role);
                        Logger.Success(`Removed donator role from user: ${user.id} because their Discord is no longer linked`);
                        return;
                    }

                    const dbUser = result[0];
                    const time = Math.round((new Date()).getTime());

                    if (time < dbUser.donator_end_time && dbUser.donator_end_time != 0)
                        return;

                    await user.roles.remove(role);
                    Logger.Success(`Removed donator role from user: ${user.id} because their donator has expired.`);
                } catch (err) {
                    Logger.Error(err);
                }
            });
        } catch (err) {
            Logger.Error(err);
        }
    }
}
