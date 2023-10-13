import * as Discord from "discord.js";
import Logger from "../logging/Logger";
import SqlDatabase from "../database/SqlDatabase";
const config = require("../config/config.json");
const JSONdb = require('simple-json-db');
const dbMuteHistory = new JSONdb('./mute-history.json');

export default class Bot {
    /**
     * The client used to interact with Discord.
     */
    public static Client: Discord.Client = new Discord.Client();

    /**
     * Initializes the Discord bot and logs it in
     */
    public static async Initialize(): Promise<void> {
        if (!config.bot.roleId)
            return Logger.Error(`Discord donator 'roleId' is not set in config.`);

        await Bot.Client.login(config.bot.token);

        Bot.Client.on('ready', () => {
            console.log(`Logged in!`);

            Bot.StartWorkerTask();
            Bot.WatchMessages();
            Bot.MemberUpdate();
        });

        Bot.Client.on('shardError', error => {
            console.error('A websocket connection encountered an error:', error);
        });

        process.on('unhandledRejection', error => {
            console.error('Unhandled promise rejection:', error);
        });

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

        if (text && embed) {
            for (const word of bannedWords) {
                if (text.includes(word)) return true;
            }
        }

        // Verify .gift urls
        if (text && text.includes("http") && regex.test(text)) {
            const groups = regex.exec(text);
            if(groups && groups[1] !== "discord") return true;
        }

        return false;
    }

    /**
     *
     * Watch mee6 !mute and !tempmute commands and save duration and reason
     *
     * @param message
     * @constructor
     * @private
     */
    private static Mute(message: any): void {
        if(!this.HasPermission(message.member))
            return;

        const regex = /^!(mute|tempmute)? ([<@!?]*&*([0-9]+)>?) (.*)/;
        const content = message.content;

        if(content && regex.test(content)) {
            const groups = regex.exec(content);

            if(groups.length === 5) {
                const discordId = groups[3];
                const reason = groups[4].trim();

                if(reason) {
                    if(dbMuteHistory.has(discordId)) {
                        let previousWarns = dbMuteHistory.get(discordId);
                        previousWarns.push(reason);
                        dbMuteHistory.set(discordId, previousWarns);
                    } else {
                        dbMuteHistory.set(discordId, [reason]);
                    }
                }
            }
        }
    }

    /**
     * Command !history {discord_id}
     *
     * Returns all previous mutes user had
     *
     * @param message
     * @constructor
     * @private
     */
    private static History(message: any): void {
        if(!this.HasPermission(message.member))
            return;

        const regex = /^!history? ([<@!?]*&*([0-9]+)>?)/;
        const content = message.content;

        if(content && regex.test(content)) {
            const groups = regex.exec(content);

            if(groups.length) {
                const discordId = groups[2];

                if (dbMuteHistory.has(discordId)) {
                    let history = dbMuteHistory.get(discordId);
                    // Keep the last 6 mutes
                    history = history.slice(Math.max(history.length - 6, 0));

                    let generatedMsg = "**Previous mutes:**\n";

                    for (const msg of history) {
                        const duration = msg.split(" ")[0];
                        generatedMsg += `**Duration:** ${duration} - **Reason:** ${msg.replace(duration, "")}\n`;
                    }

                    message.channel.send(generatedMsg);
                } else {
                    message.channel.send("User has no history!");
                }
            }
        }
    }

    /**
     *
     * Check if member has permission to use command
     *
     */

    private static HasPermission(member: any) {
        try {
            if (member.permissions.has(Discord.Permissions.FLAGS.MANAGE_MESSAGES)) return true;
            return false;
        } catch (e) {
            return false;
        }
    }

    /**
     *
     * Give action reactions
     *
     * @param message
     * @constructor
     * @private
     */
    private static MessageReactions(message: any) {
        if(message.author.bot && config.webhookIdsReaction.includes(message.author.id)) {
            message.react("👍");
            message.react("👎");
            message.react("❓");
        }
    }

    /**
     *
     * Scan message for scam
     *
     * @param message
     * @constructor
     * @private
     */
    private static Scam(message: any): void {
        // Check content first
        if(this.VerifyMessageContent(message.content)) {
            this.DeleteMessage(message, "posted scam message, it was deleted!");
        } else {
            // If its embed check title and description
            if(message.embeds.length) {
                for(const embed of message.embeds) {
                    const title = embed.title?.toLowerCase();
                    const description = embed.description?.toLowerCase();

                    if(this.VerifyMessageContent(title, true) || this.VerifyMessageContent(description, true)) {
                        this.DeleteMessage(message, "posted scam embed, it was deleted!");
                    }
                }
            }
        }
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
            Bot.Client.channels.cache.get(config.channels.logDeletedMessages).send(msg);
        });
    }

    /**
     * On message
     */
    private static WatchMessages(): void {
        Bot.Client.on('message', message => {
            Bot.MessageReactions(message);
            Bot.Mute(message);
            Bot.History(message);
            //Bot.Scam(message);
        });
    }

    private static MemberUpdate(): void {
        Bot.Client.on('guildMemberUpdate', (oldMember: any, newMember: any) => {
            let oldMemberRoleIDs = [], newMemberRoleIDs = [];
            // Save old and new role ids
            oldMember.roles.cache.each(role => {
                oldMemberRoleIDs.push(role.id);
            });
            newMember.roles.cache.each(role => {
                newMemberRoleIDs.push(role.id);
            });

            // Check if member got new role
            if (oldMemberRoleIDs.length < newMemberRoleIDs.length) {
                // Check if member already had membership role
                if (!oldMemberRoleIDs.includes(config.bot.membershipRoleId)) {
                    // Check if member has got membership role
                    if (newMemberRoleIDs.includes(config.bot.membershipRoleId)) {
                        const generateMsg = `<@${newMember.user.id}> bought membership!`;
                        // Announce it in log membership channel
                        Bot.Client.channels.cache.get(config.channels.logMembership).send(generateMsg);
                    }
                }

                // Check if member bought shop membership
                const shopMembershipRoleIds = Object.keys(config.bot.shopMembershipRoles);
                shopMembershipRoleIds.forEach(roleId => {
                    // Check if member already had the role
                    if (!oldMemberRoleIDs.includes(roleId)) { 
                        // If member has this role
                        if (newMemberRoleIDs.includes(roleId)) {
                            const generateMsg = `<@${newMember.user.id}> bought ${config.bot.shopMembershipRoles[roleId]}!`;
                            // Announce it in log membership channel
                            Bot.Client.channels.cache.get(config.channels.logMembership).send(generateMsg);
                        }
                    }
                });
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
                    let hasDonator = false;
        
                    user.roles.cache.each(role => {
                        if (role.id == config.bot.membershipRoleId) {
                            hasDonator = true;
                            return;
                        }
                    });

                    if (hasDonator)
                        return true;

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
