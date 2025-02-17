// main.js

/**
 * Fetch the ICS file from the given URL.
 * @param {string} url - The ICS URL to fetch.
 * @returns {Promise<string>} The raw ICS data as text.
 */
async function fetchICS(url) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    return await response.text();
  }
  
  /**
   * Parse the ICS file using ical.js
   * @param {string} url - The ICS URL to parse.
   * @returns {Promise<object>} An object with jcalData and events array.
   */
  async function parseICS(url) {
    const icsData = await fetchICS(url);
    if (!icsData) {
      throw new Error("No ICS data returned.");
    }
  
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
  
    // Extract all VEVENT components
    const events = comp.getAllSubcomponents("vevent").map(eventComp => {
      const vevent = new ICAL.Event(eventComp);
      return {
        summary: vevent.summary,
        start: vevent.startDate.toJSDate(),
        end: vevent.endDate.toJSDate(),
        description: vevent.description,
        location: vevent.location
      };
    });
  
    return { jcalData, events };
  }
  
  // Declare globals for tasks and the Gantt chart instance
  let tasks = [];
  let ganttChart = null;
  
  /**
   * Initialize event listeners once the DOM is fully loaded.
   */
  function init() {
    const loadButton = document.getElementById('load-btn');
    if (!loadButton) {
      console.error("Load button not found.");
      return;
    }
    loadButton.addEventListener('click', async () => {
      console.log("Load button clicked");
      const url = document.getElementById('ics-url').value;
      const outputElem = document.getElementById('output');
      const eventsTable = document.getElementById('events-table');
      const tableBody = eventsTable.querySelector('tbody');
  
      // Reset UI
      outputElem.textContent = "Loading ICS file...";
      eventsTable.style.display = "none";
      tableBody.innerHTML = "";
  
      try {
        const { jcalData, events } = await parseICS(url);
        const jsonOutput = { jcalData, events };
        const jsonString = JSON.stringify(jsonOutput, null, 2);
  
        // Display raw JSON
        outputElem.textContent = jsonString;
  
        // Display events in the table
        if (events.length > 0) {
          events.forEach(event => {
            const tr = document.createElement('tr');
  
            // Summary
            const summaryTd = document.createElement('td');
            summaryTd.textContent = event.summary || "";
            tr.appendChild(summaryTd);
  
            // Start
            const startTd = document.createElement('td');
            startTd.textContent = new Date(event.start).toLocaleString();
            tr.appendChild(startTd);
  
            // End
            const endTd = document.createElement('td');
            endTd.textContent = new Date(event.end).toLocaleString();
            tr.appendChild(endTd);
  
            // Location
            const locationTd = document.createElement('td');
            locationTd.textContent = event.location || "";
            tr.appendChild(locationTd);
  
            // Description
            const descTd = document.createElement('td');
            descTd.textContent = event.description || "";
            tr.appendChild(descTd);
  
            tableBody.appendChild(tr);
          });
          eventsTable.style.display = "table";
          
          // Convert events to tasks accepted by Frappe Gantt (include description)
          tasks = events.map((event, index) => ({
            id: '' + (index + 1),
            name: event.summary || 'No Summary',
            start: new Date(event.start).toISOString().split('T')[0], // YYYY-MM-DD format
            end: new Date(event.end).toISOString().split('T')[0],
            progress: 0, // You may calculate or set a default progress
            dependencies: '',
            description: event.description || ''
          }));
          
          // Initialize the Gantt chart with increased column width and a custom popup for dates
          ganttChart = new Gantt("#gantt", tasks, {
            view_mode: 'Day',
            bar_height: 30,
            padding: 18,
            column_width: 100, // increased column width for better date view
            custom_popup_html: function(task) {
              return `<div class="details">
                        <strong>${task.name}</strong><br/>
                        ${task.start} to ${task.end}
                      </div>`;
            },
            on_date_change: (task, start, end) => {
              const idx = tasks.findIndex(t => t.id === task.id);
              if (idx !== -1) {
                tasks[idx].start = start.toISOString().split('T')[0];
                tasks[idx].end = end.toISOString().split('T')[0];
                console.log(`Task ${task.id} updated: start=${tasks[idx].start}, end=${tasks[idx].end}`);
                try {
                  ganttChart.refresh(tasks);
                } catch (err) {
                  console.error("Error refreshing Gantt chart:", err);
                }
              }
            }
          });
          
          // Add double-click event listener on the Gantt container to allow manual editing of task details
          document.getElementById("gantt").addEventListener("dblclick", function(e) {
            const bar = e.target.closest('.bar-wrapper');
            if (bar) {
              // Ensure the bar element has a data-id attribute (Frappe Gantt usually provides this)
              const taskId = bar.getAttribute('data-id');
              if (!taskId) { return; }
              const task = tasks.find(t => t.id === taskId);
              if (!task) { return; }
              // Use prompt dialogs to update details
              const newSummary = prompt("Edit summary:", task.name);
              if (newSummary !== null) { task.name = newSummary; }
              const newStart = prompt("Edit start (YYYY-MM-DD):", task.start);
              if (newStart !== null) { task.start = newStart; }
              const newEnd = prompt("Edit end (YYYY-MM-DD):", task.end);
              if (newEnd !== null) { task.end = newEnd; }
              const newDescription = prompt("Edit description:", task.description || "");
              if (newDescription !== null) { task.description = newDescription; }
              ganttChart.refresh(tasks);
            }
          });
        } else {
          outputElem.textContent += "\n\nNo events found in the ICS file.";
        }
  
        // Also log the parsed JSON to the console
        console.log("Parsed JSON Output:\n", jsonString);
      } catch (error) {
        outputElem.textContent = "Error: " + error.message;
        console.error("Error fetching/parsing ICS:", error);
      }
    });

    // Attach listener for exporting updated ICS
    const downloadButton = document.getElementById('download-btn');
    if (!downloadButton) {
      console.error("Download button not found.");
    } else {
      downloadButton.addEventListener('click', () => {
        console.log("Download button clicked"); // Debug log
        exportICS();
      });
    }
  }
  
  // Function to generate and download updated ICS based on tasks
  function exportICS() {
    if (!tasks || tasks.length === 0) {
      console.warn("No tasks available to export. Load an ICS file first.");
      return;
    }
    console.log("Exporting ICS with tasks:", tasks);
    let icsContent = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Updated ICS Export//EN\r\n";
    tasks.forEach(task => {
      const uid = task.id + "@" + window.location.hostname;
      // Convert date from YYYY-MM-DD to ICS format YYYYMMDD
      const startICS = task.start.replace(/-/g, '');
      const endICS = task.end.replace(/-/g, '');
      icsContent += "BEGIN:VEVENT\r\n";
      icsContent += "UID:" + uid + "\r\n";
      icsContent += "SUMMARY:" + task.name + "\r\n";
      icsContent += "DTSTART;VALUE=DATE:" + startICS + "\r\n";
      icsContent += "DTEND;VALUE=DATE:" + endICS + "\r\n";
      icsContent += "END:VEVENT\r\n";
    });
    icsContent += "END:VCALENDAR";
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement("a");
    link.style.display = "none";
    link.href = URL.createObjectURL(blob);
    link.download = "updated.ics";
    document.body.appendChild(link);
    try {
      link.click();
      console.log("Download triggered.");
    } catch (err) {
      console.error("Error triggering download:", err);
    }
    document.body.removeChild(link);
  }
  
  // Run init() once the DOM content is fully loaded
  document.addEventListener("DOMContentLoaded", init);