import Logger from "../../logging/Logger";
import Bot from "../../bot/Bot";
const config = require("../../config/config.json");

export default class Donator {
    /**
     * Adds a Discord role to a particular user
     * @param req 
     * @param res 
     */
    public static async AddPOST(req: any, res: any): Promise<any> {
        try {
            if (!req.body.key || req.body.key != config.secretKey)
                return res.status(401).json({ status: 401, error: "Unauthorized" });

            if (!req.body.id)
                return res.status(400).json({ status: 400, error: "Missing Discord `id`" });
                
            await Bot.GiveDonatorRole(req.body.id);
            return res.status(200).json({ status: 200, message: "OK!" });
        } catch (err) {
            Logger.Error(err);
            return res.status(500).json({ status: 500, message: "Internal server error" });
        }
    }

    /**
     * Removes a Discord role from a particular user
     * @param req 
     * @param res 
     */
    public static async RemovePOST(req: any, res: any): Promise<any> {
        try {
            if (!req.body.key || req.body.key != config.secretKey)
                return res.status(401).json({ status: 401, error: "Unauthorized" });

            if (!req.body.id)
                return res.status(400).json({ status: 400, error: "Missing Discord `id`" });
                
            await Bot.RemoveDonatorRole(req.body.id);
            return res.status(200).json({ status: 200, message: "OK!" });
        } catch (err) {
            Logger.Error(err);
            return res.status(500).json({ status: 500, message: "Internal server error" });
        }
    }    

    /**
     * Checks if a user has the Discord premium role.
     * @param req 
     * @param res 
     * @returns 
     */
    public static async UserHasDiscordPremiumGET(req: any, res: any): Promise<void> {
        try {
            const user = await Bot.GetDiscordUser(req.params.id);

            if (user == null)
                return res.status(404).json({ status: 404, error: "User was not found" });

            let hasDonator = false;

            user.roles.cache.each(role => {
                if (role.id == config.bot.membershipRoleId) {
                    hasDonator = true;
                    return;
                }
            });

            return res.status(200).json({ status: 200, has_donator: hasDonator });
        } catch(err) {
            Logger.Error(err);
            return res.status(500).json({ status: 500, message: "Internal server error" });
        }
    }
}