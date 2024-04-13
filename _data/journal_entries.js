const campaigns = require("./campaigns.json");

module.exports = function () {
  return campaigns.reduce((acc, campaign) => {
    campaign.journal.forEach(journal => {
      acc.push({
        campaign: campaign.name,
        ...journal
      });
    })
    return acc;
  }, []);
}
