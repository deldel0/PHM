import json
import unittest

from backend.test_log_parser import LogParseError, parse_test_log


PASS_LOG = """Testprogram : ECD18010040-B-00-FAT-06    ATS2-2-2
Serial No   : A2230206847956
Model Name  : ECD18010040-B
Operator    : root
Date Process: 2026/11/12 11:27:09 AM
Test Time   : 00:03:08
Testresult  : PASS
"""

FAIL_LOG = """Testprogram : ECD18010040-B-00-FAT-05       ATS2-2-4
Serial No   : A2230206846570
Model Name  : ECD18010040-B
Operator    : root
Date Process: 2026/11/18 02:36:26 AM
Test Time   : 00:00:38
Testresult  : FAIL

================================================================================
(UUT Test seq.17) : DES DMM Measurement(5.3 Check Present after UUT1 insert) ---- (1'265) ------------------------------------------ FAIL
Step:   17 

Readings:
   Min        Reading       Max      Loops   Max Loops
   -0.100      3.316389      0.400      2         2    
================================================================================
(UUT Test seq.18) : DES DSO single Measurement(2.11 Check V1 Undershoot@UUT1 Cold Swap Requirement) ---- (2'422) ---- FAIL
Step:  18 
================================================================================
(UUT Test seq.19) : Static Test.(AC off) ---- (1'406) ---------------------------------------------------------------- PASS
Step:   19 
================================================================================
(UUT Test seq.24) : DES Turn On & Sequence DSO(2.7/4.1/4.8/4.9/4.10 Turn ON delay&Tpwok_on&Tinok_on@231Vac 100% Ld with Cap Ld(L-L 415Vac)) ---- (7'4 FAIL
Step:   24 
"""


class ParseTestLogTests(unittest.TestCase):
    def test_parses_sample_and_folder_context(self) -> None:
        record = parse_test_log(
            PASS_LOG,
            r"CD02\ATS2-2\ATS2-2-2\A2230206847956-11-27-12-November-2026.txt",
        )

        self.assertEqual(record["test_program"], "ECD18010040-B-00-FAT-06")
        self.assertEqual(record["line"], "CD02")
        self.assertEqual(record["station_group"], "ATS2-2")
        self.assertEqual(record["station"], "ATS2-2-2")
        self.assertEqual(record["serial_no"], "A2230206847956")
        self.assertEqual(record["model_name"], "ECD18010040-B")
        self.assertEqual(record["tested_at"], "2026-11-12T11:27:09")
        self.assertEqual(record["result"], "PASS")
        self.assertEqual(record["fail_items"], [])
        self.assertIsInstance(json.dumps(record), str)

    def test_extracts_first_failed_sequence_from_the_report(self) -> None:
        record = parse_test_log(FAIL_LOG)

        self.assertEqual(record["result"], "FAIL")
        self.assertEqual(record["tested_at"], "2026-11-18T02:36:26")
        self.assertEqual(
            record["fail_items"],
            [
                {
                    "sequence": 17,
                    "step": 17,
                    "description": "DES DMM Measurement(5.3 Check Present after UUT1 insert)",
                },
            ],
        )

    def test_handles_report_line_prefixes_and_truncated_headers(self) -> None:
        record = parse_test_log(
            "STEP.3(UUT Test seq.3) : DES UUT Communication(6.1 Set I2C Pullup Voltage 3 PASS\n"
            "STEP.14(UUT Test seq.14) : DES DMM Measurement(Check UUT2 V1 on) ---- (2'87 FAIL\n"
            "Step:  14 \n"
            "STEP.95(UUT Test seq.95) : DES UUT Communication(Unlock@UUT1) ---- (0'438) --- FAIL\n"
            "Step:  95 \n"
        )

        self.assertEqual(
            record["fail_items"],
            [
                {
                    "sequence": 14,
                    "step": 14,
                    "description": "DES DMM Measurement(Check UUT2 V1 on)",
                },
            ],
        )

    def test_keeps_first_explicit_fail_item_label(self) -> None:
        record = parse_test_log(
            "Testresult: FAIL\nFail Item: VOUT_1\nFail 測項: VOUT_2\n"
            "Fixture No: F-17\n"
        )

        self.assertEqual(record["result"], "FAIL")
        self.assertEqual(
            record["fail_items"],
            [{"sequence": None, "step": None, "description": "VOUT_1"}],
        )
        self.assertEqual(
            set(record),
            {
                "schema_version",
                "test_program",
                "serial_no",
                "model_name",
                "tested_at",
                "result",
                "line",
                "station_group",
                "station",
                "fail_items",
            },
        )

    def test_allows_fail_result_without_failed_sequence(self) -> None:
        record = parse_test_log(
            "Testresult  : FAIL  \n"
            "STEP.3(UUT Test seq.3) : DES UUT Communication(6.1 Set I2C Pullup Voltage 3 PASS\n"
        )

        self.assertEqual(record["result"], "FAIL")
        self.assertEqual(record["fail_items"], [])

    def test_falls_back_to_folder_station_when_testprogram_has_group_only(self) -> None:
        record = parse_test_log(
            "Testprogram : ECD18010040-B-00-FAT-04       ATS2-2\n",
            r"CD02\ATS2-2\ATS2-2-3\A2231021412295-12-00-06-November-2026.txt",
        )

        self.assertEqual(record["test_program"], "ECD18010040-B-00-FAT-04")
        self.assertEqual(record["line"], "CD02")
        self.assertEqual(record["station_group"], "ATS2-2")
        self.assertEqual(record["station"], "ATS2-2-3")

    def test_testprogram_station_wins_over_folder_station(self) -> None:
        record = parse_test_log(
            PASS_LOG,
            r"CD02\ATS2-2\ATS2-2-1\A2230206847956-11-27-12-November-2026.txt",
        )

        self.assertEqual(record["station_group"], "ATS2-2")
        self.assertEqual(record["station"], "ATS2-2-2")

    def test_rejects_malformed_recognized_values(self) -> None:
        with self.assertRaisesRegex(LogParseError, "Invalid dateprocess"):
            parse_test_log("Date Process: not-a-date\n")

    def test_rejects_unexpected_folder_depth(self) -> None:
        with self.assertRaisesRegex(LogParseError, "LINE"):
            parse_test_log(PASS_LOG, r"CD02\ATS2-2\file.txt")


if __name__ == "__main__":
    unittest.main()
