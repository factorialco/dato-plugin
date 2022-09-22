import { Button, TextField } from "datocms-react-ui";
import { useState } from "react";
import { CommonToolProps } from "../forms.types";
import s from "../../styles.module.css";
import { MARKETING_FORM_CAMPAIGN } from "../../../constants/marketingFormCampaign";

export const SearchTool = ({ isLoading, onSubmit }: CommonToolProps) => {
  const [query, setQuery] = useState("");

  const queryCampaign = (query: string) =>
    onSubmit(async (campaigns) =>
      Object.entries(campaigns)
        .filter(([_, campaigns]) =>
          campaigns.some((campaign) =>
            campaign.marketing_form_campaign
              .toLowerCase()
              .includes(query.toLowerCase())
          )
        )
        .map(([id]) => ({ id }))
    );

  return (
    <form
      className={s.toolsRow}
      onSubmit={(e) => {
        e.preventDefault();
        queryCampaign(query);
      }}
    >
      <div className={s.searchInput}>
        <TextField
          name="campaign_search"
          id="query"
          label={MARKETING_FORM_CAMPAIGN}
          onChange={setQuery}
          value={query}
        />
      </div>
      <Button type="submit" disabled={isLoading || !query} className={s.button}>
        Search
      </Button>
    </form>
  );
};
