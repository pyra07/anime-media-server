import db from "../database/db";
import schedule from "../Scheduler/schedule";
import { Command } from "../utils/types";
import readline from "readline";
import { interval, token } from "../../profile.json";
import discordBot from "../DiscordBot/main";

class ui {
  private commands: Command[];
  private cl: readline.Interface;

  constructor() {
    this.commands = [];
    this.cl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
  }

  private addCommands(msg: string, cmd: Function) {
    this.commands.push({
      msg,
      cmd,
    });
  }

  private printCommands(): string {
    return this.commands.map((c, i) => `${i + 1}.\t${c.msg}`).join("\n");
  }

  private async runSchedulerOnce() {
    console.log("Checking for Anime...");
    await db.logIn();
    await schedule.check();
    console.log("Done! Exiting now...");
    process.exit();
  }

  private async runScheduler() {
    console.log("Running the scheduler...");
    await db.logIn();
    await schedule.run(`*/${interval} * * * *`);
  }

  private async runSchedulerDiscord() {
    console.log("Running the scheduler...");
    await db.logIn();
    await schedule.run(`*/${interval} * * * *`);
    discordBot.start(token);
  }

  public async init() {
    this.addCommands("Run the Anime Scheduler (once)", this.runSchedulerOnce);
    this.addCommands("Run the Anime Scheduler", this.runScheduler);
    this.addCommands(
      "Run the Anime Scheduler AND Discord Bot (need creds)",
      async () => await this.runSchedulerDiscord()
    );
    this.addCommands("Exit", () => process.exit());

    this.cl.question(
      `Welcome to Animu!\n${this.printCommands()}\nPlease enter your command: `,
      (answer) => {
        const cmd = this.commands[parseInt(answer) - 1];
        if (cmd) {
          cmd.cmd();
          this.cl.close();
        } else {
          console.log("Invalid command!");
          this.cl.close();
          process.exit();
        }
      }
    );
  }
}

export default new ui();
