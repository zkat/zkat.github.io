const campaigns = require("./campaigns.cjs");

module.exports = function () {
  return campaigns.reduce((acc, campaign) => {
    campaign.lore.forEach(lore => {
      acc.push({
        campaignId: campaign.id,
        campaignName: campaign.name,
        ...lore
      });
    })
    return acc;
  }, []);
}

