module.exports = {
  ci: {
    collect: {
      startServerCommand: "npm run preview -w web -- --host 127.0.0.1 --port 4173",
      url: ["http://127.0.0.1:4173/", "http://127.0.0.1:4173/inventory"],
      numberOfRuns: 1
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.7 }],
        "first-contentful-paint": ["warn", { maxNumericValue: 3000 }],
        "interactive": ["warn", { maxNumericValue: 5000 }]
      }
    },
    upload: {
      target: "temporary-public-storage"
    }
  }
};
