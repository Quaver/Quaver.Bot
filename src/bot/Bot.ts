import * as Discord from "discord.js";
import Logger from "../logging/Logger";
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
}