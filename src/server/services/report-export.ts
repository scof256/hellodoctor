/**
 * Report Export Service
 * Provides utilities for exporting analytics data as CSV and PDF.
 * Requirements: 28.7
 */

/**
 * Generate CSV content from data array
 */
export function generateCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; header: string }[]
): string {
  if (data.length === 0) {
    return columns.map(c => c.header).join(',');
  }

  const headers = columns.map(c => c.header).join(',');
  const rows = data.map(row => 
    columns.map(col => {
      const value = row[col.key];
      // Escape values that contain commas or quotes
      if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value ?? '');
    }).join(',')
  );

  return [headers, ...rows].join('\n');
}

/**
 * Generate a simple HTML report that can be printed as PDF
 * This creates a printable HTML document that users can save as PDF via browser print
 */
export function generatePrintableReport(
  title: string,
  subtitle: string,
  sections: {
    title: string;
    data: { label: string; value: string | number }[];
  }[],
  tables?: {
    title: string;
    headers: string[];
    rows: (string | number)[][];
  }[]
): string {
  const sectionHtml = sections.map(section => `
    <div class="section">
      <h2>${section.title}</h2>
      <div class="stats-grid">
        ${section.data.map(item => `
          <div class="stat-item">
            <div class="stat-value">${item.value}</div>
            <div class="stat-label">${item.label}</div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');

  const tableHtml = tables?.map(table => `
    <div class="section">
      <h2>${table.title}</h2>
      <table>
        <thead>
          <tr>
            ${table.headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${table.rows.map(row => `
            <tr>
              ${row.map(cell => `<td>${cell}</td>`).join('')}
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `).join('') ?? '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      padding: 40px;
      color: #1e293b;
      line-height: 1.5;
    }
    .header {
      text-align: center;
      margin-bottom: 40px;
      padding-bottom: 20px;
      border-bottom: 2px solid #e2e8f0;
    }
    .header h1 {
      font-size: 28px;
      color: #0f172a;
      margin-bottom: 8px;
    }
    .header p {
      color: #64748b;
      font-size: 14px;
    }
    .section {
      margin-bottom: 32px;
    }
    .section h2 {
      font-size: 18px;
      color: #334155;
      margin-bottom: 16px;
      padding-bottom: 8px;
      border-bottom: 1px solid #e2e8f0;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
    }
    .stat-item {
      background: #f8fafc;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-value {
      font-size: 24px;
      font-weight: 700;
      color: #0ea5e9;
    }
    .stat-label {
      font-size: 12px;
      color: #64748b;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #e2e8f0;
    }
    th {
      background: #f8fafc;
      font-weight: 600;
      color: #475569;
    }
    tr:hover {
      background: #f8fafc;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e2e8f0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
    }
    @media print {
      body {
        padding: 20px;
      }
      .stats-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>${subtitle}</p>
  </div>
  ${sectionHtml}
  ${tableHtml}
  <div class="footer">
    Generated on ${new Date().toLocaleString()} | Doctor Appointment SaaS Platform
  </div>
</body>
</html>
  `.trim();
}

/**
 * Format date for display in reports
 */
export function formatReportDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Format number with appropriate suffix (K, M, etc.)
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K';
  }
  return num.toString();
}
