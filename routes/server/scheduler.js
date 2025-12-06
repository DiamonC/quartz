const express = require("express");
const router = express.Router({ mergeParams: true });
const schedules = require("../../scripts/schedules.js");
const utils = require("../../scripts/utils.js");
const readJSON = utils.readJSON;
const hasAccess = utils.hasAccess;

// Get all user tasks for a server
router.get("/", (req, res) => {
  try {
    const email = req.headers.username;
    const token = req.headers.token;
    const account = readJSON("accounts/" + email + ".json");

    if (!hasAccess(token, account, req.params.id)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const serverId = req.params.id;
    const allSchedules = schedules.readSchedules();
    const serverTasks = allSchedules.userTasks.filter((t) => t.serverId === serverId);

    res.json({
      tasks: serverTasks,
      count: serverTasks.length,
    });
  } catch (err) {
    console.error("Error fetching tasks:", err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// Create a new task
router.post("/create", (req, res) => {
  try {
    const email = req.headers.username;
    const token = req.headers.token;
    const account = readJSON("accounts/" + email + ".json");

    if (!hasAccess(token, account, req.params.id)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const serverId = req.params.id;
    const { name, type, schedule, command } = req.body;

    if (!name || !type || !schedule) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (type === "command" && !command) {
      return res.status(400).json({ error: "Command is required for command tasks" });
    }

    if (!["backup", "command", "restart"].includes(type)) {
      return res.status(400).json({ error: "Invalid task type" });
    }

    const task = schedules.createTask(serverId, name, type, schedule, command);

    res.status(201).json({
      msg: "Done",
      task,
    });
  } catch (err) {
    console.error("Error creating task:", err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// Update a task
router.post("/update/:taskId", (req, res) => {
  try {
    const email = req.headers.username;
    const token = req.headers.token;
    const account = readJSON("accounts/" + email + ".json");

    if (!hasAccess(token, account, req.params.id)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const serverId = req.params.id;
    const taskId = req.params.taskId;
    const { name, type, schedule, command, enabled } = req.body;

    // Verify task belongs to this server
    const allSchedules = schedules.readSchedules();
    let task = allSchedules.userTasks.find((t) => t.id === taskId);

    if (!task) {
      task = allSchedules.systemTasks.find((t) => t.id === taskId);
    }

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.serverId !== serverId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (type !== undefined) updates.type = type;
    if (schedule !== undefined) updates.schedule = schedule;
    if (command !== undefined) updates.command = command;
    if (enabled !== undefined) updates.enabled = enabled;

    const updatedTask = schedules.updateTask(taskId, updates);

    res.json({
      msg: "Done",
      task: updatedTask,
    });
  } catch (err) {
    console.error("Error updating task:", err);
    res.status(500).json({ error: "Failed to update task" });
  }
});

// Delete a task
router.post("/delete/:taskId", (req, res) => {
  try {
    const email = req.headers.username;
    const token = req.headers.token;
    const account = readJSON("accounts/" + email + ".json");

    if (!hasAccess(token, account, req.params.id)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const serverId = req.params.id;
    const taskId = req.params.taskId;

    // Verify task belongs to this server
    const allSchedules = schedules.readSchedules();
    let task = allSchedules.userTasks.find((t) => t.id === taskId);

    if (!task) {
      task = allSchedules.systemTasks.find((t) => t.id === taskId);
    }

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.serverId !== serverId) {
      return res.status(403).json({ error: "Access denied" });
    }

    schedules.deleteTask(taskId);

    res.json({
      msg: "Done",
    });
  } catch (err) {
    console.error("Error deleting task:", err);
    res.status(500).json({ error: "Failed to delete task" });
  }
});

// Toggle task enabled/disabled
router.post("/toggle/:taskId", (req, res) => {
  try {
    const email = req.headers.username;
    const token = req.headers.token;
    const account = readJSON("accounts/" + email + ".json");

    if (!hasAccess(token, account, req.params.id)) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const serverId = req.params.id;
    const taskId = req.params.taskId;

    // Verify task belongs to this server
    const allSchedules = schedules.readSchedules();
    let task = allSchedules.userTasks.find((t) => t.id === taskId);

    if (!task) {
      task = allSchedules.systemTasks.find((t) => t.id === taskId);
    }

    if (!task) {
      return res.status(404).json({ error: "Task not found" });
    }

    if (task.serverId !== serverId) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updatedTask = schedules.toggleTask(taskId);

    res.json({
      msg: "Done",
      task: updatedTask,
    });
  } catch (err) {
    console.error("Error toggling task:", err);
    res.status(500).json({ error: "Failed to toggle task" });
  }
});

module.exports = router;
