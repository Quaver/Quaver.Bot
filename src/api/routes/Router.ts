
import * as express from "express";
import Donator from "../controllers/Donator";

export default class Router {
    /**
     * Initializes the API routes for the server
     * @param app 
     */
    public static InitializeRouter(app: Express.Application): express.Router {
        const router: express.Router = express.Router();

        router.route("/donator/add").post(Donator.AddPOST);
        router.route("/donator/remove").post(Donator.RemovePOST);
        router.route("/donator/discord/check/:id").get(Donator.UserHasDiscordPremiumGET);

        router.route("*").get((req, res) => res.status(404).json({ error: 404, message: "Nothing was found here" }));

        return router;
    };
}