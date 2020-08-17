import SqlDatabase from "./database/SqlDatabase";
import Bot from "./bot/Bot";
import API from "./api/API";
const config = require("./config/config.json");

class Program {
    /**
     * Main execution point
     */
    public static async Main(): Promise<void> {
        await SqlDatabase.Initialize(config.databaseSql.host, config.databaseSql.user, config.databaseSql.password, config.databaseSql.database, 10);
        await Bot.Initialize();
        new API(config.port);
    }
}

Program.Main();