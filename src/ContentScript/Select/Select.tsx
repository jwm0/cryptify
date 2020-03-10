import React from "react";

import { Modal } from "../Modal";

type Props = {
  options: { id: string; alias: string }[];
  handleSelect: (value: string) => void;
};

export const Select: React.FC<Props> = ({ options, handleSelect }) => {
  return (
    <Modal>
      <select
        onChange={({ target: { value } }) => {
          handleSelect(value);
        }}
      >
        <option disabled selected value="">
          -- select conversation id --
        </option>
        {options.map(o => {
          return <option value={o.id}>{o.alias}</option>;
        })}
      </select>
    </Modal>
  );
};
