import express from "express";
import bodyParser = require("body-parser");
import Router from "./routes/Router";
import path from "path";
import Logger from "../logging/Logger";
const config = require("../config/config.json");

export default class API {
    /**
     * The port the server will run on.
     */
    public port: Number;

    /**
     * The created express server application.
     */
    public expressApp: express.Application;

    /**
     * Starts a new instance of the server
     * @param port
     */
    constructor(port: Number) {
        this.port = port;
        this.expressApp = express();

        this.InitializeServer();
    }

    /**
     * Initializes and runs the server.
     * @constructor
     */
    private InitializeServer(): void {
        this.expressApp.use(bodyParser.json());
        this.expressApp.use(bodyParser.urlencoded({extended: true}));
        
        this.expressApp.use("/", Router.InitializeRouter(this.expressApp));
        this.expressApp.listen(this.port, () => Logger.Success(`Quaver.Bot has started on port: ${this.port}`));
    }
}