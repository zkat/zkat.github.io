const campaigns = require("./campaigns.cjs");

module.exports = function () {
  return campaigns.reduce((acc, campaign) => {
    campaign.journal.forEach(journal => {
      acc.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        ...journal
      });
    })
    return acc;
  }, []);
}
