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
  
  /**
   * Initialize event listeners once the DOM is fully loaded.
   */
  function init() {
    const loadButton = document.getElementById('load-btn');
    loadButton.addEventListener('click', async () => {
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
          
          // Convert events to tasks accepted by Frappe Gantt
          const tasks = events.map((event, index) => ({
            id: '' + (index + 1),
            name: event.summary || 'No Summary',
            start: new Date(event.start).toISOString().split('T')[0], // YYYY-MM-DD format
            end: new Date(event.end).toISOString().split('T')[0],
            progress: 0, // You may calculate or set a default progress
            dependencies: ''
          }));
          
          // Initialize the Gantt chart
          const gantt = new Gantt("#gantt", tasks, {
            view_mode: 'Day',
            bar_height: 30,
            padding: 18,
            column_width: 45
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
  }
  
  // Run init() once the DOM content is fully loaded
  document.addEventListener("DOMContentLoaded", init);