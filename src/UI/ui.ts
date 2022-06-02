import db from "database/db";
import schedule from "Scheduler/schedule";
import { Command } from "utils";
import readline from "readline";
import { interval, token } from "profile.json";
import discordBot from "DiscordBot/main";

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
    console.log("Done!");
    process.exit();
  }

  private async runScheduler() {
    console.log("Running the scheduler...");
    await db.logIn();
    // Run every x minutes, from 12:00 to 04:00
    // Then run every hour, from 05:00 to 11:00
    await schedule.run(`*/${interval} 12-23,00-04 * * *`, true); // Peak hours
    await schedule.run(`0 05-11 * * *`, false); // Off peak hours
  }

  private async runSchedulerDiscord() {
    discordBot.start(token);
    this.runScheduler();
  }

  private async selectChoice(arg: number) {
    const cmd = this.commands[arg - 1];
    if (cmd) {
      cmd.cmd();
      this.cl.close();
    } else {
      console.log("Invalid command!");
      this.cl.close();
      process.exit();
    }
  }

  public async init(arg?: string) {
    this.addCommands("Run the Anime Scheduler (once)", this.runSchedulerOnce);
    this.addCommands("Run the Anime Scheduler", this.runScheduler);
    this.addCommands(
      "Run the Anime Scheduler AND Discord Bot (need creds)",
      async () => await this.runSchedulerDiscord()
    );
    this.addCommands("Exit", () => process.exit());

    // Check if arg is a number
    if (arg && !isNaN(Number(arg))) this.selectChoice(Number(arg));
    else {
      console.log(this.printCommands());
      this.cl.question("Enter your choice: ", (answer) => {
        this.selectChoice(Number(answer));
      });
    }
  }
}

export default new ui();
