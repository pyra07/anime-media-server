# Used to run animu with pm2
# This makes it so that the script can be restarted easily
# in case of a crash
# This runs the scheduler alongside discord bot
pm2 start ts-node -- --type-check -r tsconfig-paths/register src/main.ts 3 --watch