const fs = require("fs");
const path = require("path");
const cronParser = require("cron-parser");

const SCHEDULES_FILE = "./assets/schedules.json";

// Import other scripts needed for task execution
let mc = null;
let files = null;
const registeredFunctions = {}; // Store registered functions for "function" type tasks

function setDependencies(mcScript, filesScript) {
  mc = mcScript;
  files = filesScript;
}

// Register a function to be used by function-type tasks
function registerFunction(functionName, fn) {
  if (typeof fn !== "function") {
    throw new Error("Second argument must be a function");
  }
  registeredFunctions[functionName] = fn;
  console.log(`[Scheduler] Registered function: ${functionName}`);
}

// Initialize schedules file if it doesn't exist
function initializeSchedules() {
  if (!fs.existsSync(SCHEDULES_FILE)) {
    const defaultSchedules = {
      userTasks: [],
      systemTasks: [],
    };
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(defaultSchedules, null, 2));
  }
}

// Read schedules from file
function readSchedules() {
  try {
    if (!fs.existsSync(SCHEDULES_FILE)) {
      initializeSchedules();
    }
    const data = fs.readFileSync(SCHEDULES_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading schedules:", err);
    return { userTasks: [], systemTasks: [] };
  }
}

// Write schedules to file
function writeSchedules(data) {
  try {
    fs.writeFileSync(SCHEDULES_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("Error writing schedules:", err);
  }
}

// Get all user tasks for a server
function getServerTasks(serverId) {
  const schedules = readSchedules();
  return schedules.userTasks.filter((t) => t.serverId === serverId && t.enabled);
}

// Get all system tasks for a server
function getServerSystemTasks(serverId) {
  const schedules = readSchedules();
  return schedules.systemTasks.filter((t) => t.serverId === serverId && t.enabled);
}

// Create a new user task
function createTask(serverId, taskName, taskType, schedule, command = null) {
  const schedules = readSchedules();
  const taskId = `task_${Date.now()}`;

  const newTask = {
    id: taskId,
    serverId,
    name: taskName,
    type: taskType, // "backup", "command", "restart"
    schedule,
    command: command || null,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastRun: null,
    nextRun: calculateNextRun(schedule),
  };

  schedules.userTasks.push(newTask);
  writeSchedules(schedules);
  return newTask;
}

// Create a new system task (for internal use)
function createSystemTask(serverId, taskName, taskType, schedule, command = null) {
  const schedules = readSchedules();
  const taskId = `sys_task_${Date.now()}`;

  const newTask = {
    id: taskId,
    serverId,
    name: taskName,
    type: taskType, // "backup", "command", "restart"
    schedule,
    command: command || null,
    enabled: true,
    createdAt: new Date().toISOString(),
    lastRun: null,
    nextRun: calculateNextRun(schedule),
  };

  schedules.systemTasks.push(newTask);
  writeSchedules(schedules);
  return newTask;
}

// Update an existing task (searches both user and system tasks)
function updateTask(taskId, updates) {
  const schedules = readSchedules();

  // Search in user tasks first
  let taskIndex = schedules.userTasks.findIndex((t) => t.id === taskId);
  let task = null;

  if (taskIndex !== -1) {
    task = schedules.userTasks[taskIndex];
  } else {
    // Search in system tasks
    taskIndex = schedules.systemTasks.findIndex((t) => t.id === taskId);
    if (taskIndex !== -1) {
      task = schedules.systemTasks[taskIndex];
    }
  }

  if (!task) {
    throw new Error("Task not found");
  }

  Object.assign(task, updates);

  // Recalculate nextRun if schedule changed
  if (updates.schedule) {
    task.nextRun = calculateNextRun(updates.schedule);
  }

  writeSchedules(schedules);
  return task;
}

// Delete a task (searches both user and system tasks)
function deleteTask(taskId) {
  const schedules = readSchedules();
  schedules.userTasks = schedules.userTasks.filter((t) => t.id !== taskId);
  schedules.systemTasks = schedules.systemTasks.filter((t) => t.id !== taskId);
  writeSchedules(schedules);
}

// Toggle task enabled/disabled (searches both user and system tasks)
function toggleTask(taskId) {
  const schedules = readSchedules();

  // Search in user tasks first
  let task = schedules.userTasks.find((t) => t.id === taskId);

  if (!task) {
    // Search in system tasks
    task = schedules.systemTasks.find((t) => t.id === taskId);
  }

  if (!task) {
    throw new Error("Task not found");
  }

  task.enabled = !task.enabled;
  writeSchedules(schedules);
  return task;
}

// Calculate next run time based on cron expression
function calculateNextRun(cronExpression) {
  try {
    const interval = cronParser.parseExpression(cronExpression);
    const nextDate = interval.next();
    return nextDate.toISOString();
  } catch (err) {
    console.error("Invalid cron expression:", cronExpression, err);
    return null;
  }
}

// Check if a task should run now
function shouldTaskRun(task) {
  if (!task.enabled) return false;

  try {
    const interval = cronParser.parseExpression(task.schedule);
    const now = new Date();
    const nextRun = new Date(task.nextRun);

    // Consider a task ready if we're within 1 minute window
    const timeDiff = Math.abs(now - nextRun);
    return timeDiff < 60000;
  } catch (err) {
    console.error("Error parsing cron:", err);
    return false;
  }
}

// Execute a task
async function executeTask(task) {
  try {
    console.log(`[Scheduler] Executing task: ${task.name} (${task.type})`);

    switch (task.type) {
      case "backup":
        await executeBackup(task);
        break;
      case "command":
        await executeCommand(task);
        break;
      case "restart":
        await executeRestart(task);
        break;
      case "function":
        await executeFunction(task);
        break;
      default:
        console.error(`Unknown task type: ${task.type}`);
    }

    // Update last run and next run
    updateTask(task.id, {
      lastRun: new Date().toISOString(),
      nextRun: calculateNextRun(task.schedule),
    });
  } catch (err) {
    console.error(`[Scheduler] Error executing task ${task.id}:`, err);
  }
}

// Execute backup task
async function executeBackup(task) {
  if (!mc || !mc.backupAsync) {
    console.error("Backup function not available");
    return;
  }

  return new Promise((resolve, reject) => {
    mc.backupAsync(task.serverId, (err) => {
      if (err) {
        console.error(`[Scheduler] Backup failed for server ${task.serverId}:`, err);
        reject(err);
      } else {
        console.log(`[Scheduler] Backup completed for server ${task.serverId}`);
        resolve();
      }
    });
  });
}

// Execute command task
async function executeCommand(task) {
  if (!files || !files.writeTerminal) {
    console.error("writeTerminal function not available");
    return;
  }

  files.writeTerminal(task.serverId, task.command);
  console.log(`[Scheduler] Command executed on server ${task.serverId}: ${task.command}`);
}

// Execute restart task
async function executeRestart(task) {
  if (!mc || !mc.stopAsync) {
    console.error("Stop function not available");
    return;
  }

  // Send warning message
  if (files && files.writeTerminal) {
    files.writeTerminal(task.serverId, "say [Scheduler] Server restarting in 5 minutes");
  }

  // Wait 4 minutes then send final warning
  setTimeout(() => {
    if (files && files.writeTerminal) {
      files.writeTerminal(task.serverId, "say [Scheduler] Server restarting in 1 minute");
    }
  }, 4 * 60 * 1000);

  // Stop server after 5 minutes
  setTimeout(() => {
    return new Promise((resolve, reject) => {
      mc.stopAsync(task.serverId, (err) => {
        if (err) {
          console.error(`[Scheduler] Restart failed for server ${task.serverId}:`, err);
          reject(err);
        } else {
          console.log(`[Scheduler] Server ${task.serverId} stopped for restart`);
          resolve();
        }
      });
    });
  }, 5 * 60 * 1000);
}

// Execute function task
async function executeFunction(task) {
  const fn = registeredFunctions[task.command];

  if (!fn) {
    console.error(`[Scheduler] Function not found: ${task.command}`);
    return;
  }

  try {
    const result = await fn(task.serverId);
    console.log(`[Scheduler] Function executed: ${task.command} for server ${task.serverId}`);
  } catch (err) {
    console.error(`[Scheduler] Function failed: ${task.command}`, err);
  }
}

// Start the scheduler - should be called from run.js
function startScheduler(mcScript, filesScript) {
  setDependencies(mcScript, filesScript);
  initializeSchedules();

  console.log("[Scheduler] Task scheduler started");

  // Check for tasks to run every 30 seconds
  setInterval(() => {
    const schedules = readSchedules();

    // Check user tasks
    schedules.userTasks.forEach((task) => {
      if (shouldTaskRun(task)) {
        executeTask(task);
      }
    });

    // Check system tasks
    schedules.systemTasks.forEach((task) => {
      if (shouldTaskRun(task)) {
        executeTask(task);
      }
    });
  }, 30000); // Check every 30 seconds
}

module.exports = {
  startScheduler,
  initializeSchedules,
  getServerTasks,
  getServerSystemTasks,
  createTask,
  createSystemTask,
  updateTask,
  deleteTask,
  toggleTask,
  calculateNextRun,
  setDependencies,
  readSchedules,
  registerFunction,
};
