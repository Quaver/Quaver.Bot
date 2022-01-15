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
     *
     * Checks if string contains banned word
     *
     * @param text
     * @constructor
     * @private
     */
    private static VerifyMessageContent(text: string, embed: boolean = false): boolean {
        const regex = /https?:\/\/(.*).gift/;
        const bannedWords = [
            "gifted", "nitro"
        ];

        if(embed) {
            for (const word of bannedWords) {
                if (text.includes(word)) return true;
            }
        }

        // If the check fails verify the url
        if (text.includes("http") && regex.test(text)) {
            const groups = regex.exec(text);
            if(groups && groups[1] !== "discord") return true;
        }

        return false;
    }

    /**
     *
     *  Deleted message with custom text response
     *
     * @param message
     * @param text
     * @constructor
     * @private
     */
    private static DeleteMessage(message: any, text: string = "message was deleted!"): void {
        let msg = `<@${message.author.id}> ${text}`
        message.delete().then(r => {
            // @ts-ignore
            Bot.Client.channels.cache.get(config.logChannelId).send(msg);
        });
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
                const content = message.content;

                // Check content first
                if(this.VerifyMessageContent(content)) {
                    this.DeleteMessage(message, "posted scam message, it was deleted!");
                    Logger.Warning(`Scam message was deleted!`);
                } else {
                    // If its embed check title and description
                    if(message.embeds.length) {
                        for(const embed of message.embeds) {
                            const title = embed.title?.toLowerCase();
                            const description = embed.description?.toLowerCase();

                            if(this.VerifyMessageContent(title, true) || this.VerifyMessageContent(description, true)) {
                                this.DeleteMessage(message, "posted scam embed, it was deleted!");
                                Logger.Warning(`Scam embed was deleted!`);
                            }
                        }
                    }
                }
            }
        });
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